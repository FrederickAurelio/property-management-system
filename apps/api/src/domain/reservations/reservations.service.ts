import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiFieldReason,
  canUndoPaymentMovement,
  buildPageInfo,
  CancelDisposition,
  CollectedVia,
  getConfirmFieldGaps,
  IcalSyncWarning,
  isUnitStatusBookable,
  OCCUPYING_RESERVATION_STATUSES,
  PaymentMovementDirection,
  PaymentMovementKind,
  PaymentStatus,
  recomputePaymentStatus,
  refundDueIdr,
  ReservationBoard,
  ReservationListSort,
  ReservationStatus,
  signedAmountFor,
  StayBillingPeriod,
  sumPaidFromMovements,
  todayYmdInTimezone,
  isValidStayPeriodRange,
  computeInventoryEndYmd,
  computeMeterIntervalCharges,
  lookupUtilityPeriodScheme,
  normalizeMaintenanceChargeDateYmd,
  recomputeStayQuoteTotal,
  resolveUtilitySchemeSnapshot,
  sumAdminChargesIdr,
  sumMaintenanceChargesIdr,
  UTILITY_ADDON_MAX_PER_KIND,
  UtilityKind,
  yearMonthToChargeDateYmd,
  type UtilityAddon,
  type UtilityPeriodScheme,
  type UtilitySchemeSnapshot,
  ymdYearMonth,
  type Paginated,
  type StaffAdmin,
  type StaffReservation,
  type StaffReservationListItem,
  type StaffUtilityStatementBankAccount,
  type StayBillingPeriod as StayBillingPeriodType,
  type UtilityStatementPayee,
  UTILITY_STATEMENT_BANK_ACCOUNT_RECENT_MAX,
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma/index.js';
import { PDF_CONVERT } from '../../integrations/pdf-convert/pdf-convert.port.js';
import type { PdfConvertPort } from '../../integrations/pdf-convert/pdf-convert.port.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { IcalImportService } from '../ical/ical-import.service.js';
import type { CancelReservationDto } from './dto/cancel-reservation.dto.js';
import type { ConfirmEarlyDto } from './dto/confirm-early.dto.js';
import type { CreateReservationDto } from './dto/create-reservation.dto.js';
import type { ListReservationsQueryDto } from './dto/list-reservations.query.dto.js';
import type { PatchPaymentMovementProofsDto } from './dto/patch-payment-movement-proofs.dto.js';
import type { PostPaymentMovementDto } from './dto/post-payment-movement.dto.js';
import type { PutReservationUtilitiesDto } from './dto/put-reservation-utilities.dto.js';
import type { UpdateReservationDto } from './dto/update-reservation.dto.js';
import { findOccupyingOverlap, type OverlapHit } from './overlap.js';
import {
  arrivalsWindow,
  departuresWindow,
  findOverpaidReservationIds,
  findUtilitiesDueReservationIds,
  reservationListSelect,
  withOpenBalanceMoney,
} from './reservation-board-where.js';
import {
  asUtilityAddons,
  parseYmd,
  toStaffReservation,
  toStaffReservationListItem,
} from './reservations-mapper.js';
import {
  billUtilityPeriodMeters,
  buildUtilityStatementFillInput,
  utilityStatementFilename,
} from './utility-statement-build.js';
import { reconstructUtilityPeriods } from './utility-statement-period.js';
import { fillUtilityStatementXlsx } from './utility-statement-fill.js';

/** Fallback when boards list all properties (doc prefers property-scoped boards). */
const DEFAULT_BOARD_TIMEZONE = 'Asia/Jakarta';

function toStaffUtilityStatementBankAccount(row: {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  lastUsedAt: Date;
}): StaffUtilityStatementBankAccount {
  return {
    id: row.id,
    bankName: row.bankName,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    lastUsedAt: row.lastUsedAt.toISOString(),
  };
}

function uniqueChargeMonthsOrThrow(
  charges: ReadonlyArray<{ chargeDate: string }>,
  message: string,
): void {
  const months = new Set<string>();
  for (const c of charges) {
    const ym = ymdYearMonth(c.chargeDate);
    if (!ym || months.has(ym)) {
      throw new BadRequestException({
        message,
        details: {
          field: 'chargeDate',
          reason: ApiFieldReason.DUPLICATE_READING_DATE,
        },
      });
    }
    months.add(ym);
  }
}

function throwMeterError(error: unknown): never {
  const code = error instanceof Error ? error.message : 'INVALID_METER';
  if (code === 'METER_DECREASED') {
    throw new BadRequestException({
      message: 'Meter reading cannot be lower than the previous reading',
      details: {
        field: 'meterValue',
        reason: ApiFieldReason.METER_DECREASED,
      },
    });
  }
  if (code === 'DUPLICATE_READING_DATE') {
    throw new BadRequestException({
      message: 'Duplicate reading date for the same utility',
      details: {
        field: 'readingDate',
        reason: ApiFieldReason.DUPLICATE_READING_DATE,
      },
    });
  }
  throw new BadRequestException({
    message: 'Invalid meter readings',
    details: {
      field: 'meterValue',
      reason: ApiFieldReason.DATE_RANGE_INVALID,
    },
  });
}

function assertMeterChain(
  readings: ReadonlyArray<{ readingDate: string; meterValue: number }>,
): void {
  if (readings.length < 2) {
    return;
  }
  computeMeterIntervalCharges(readings, 1);
}

function uniqueSchemeMonthsOrThrow(
  schemes: ReadonlyArray<{ chargeYearMonth: string }>,
): void {
  const months = new Set<string>();
  for (const row of schemes) {
    if (months.has(row.chargeYearMonth)) {
      throw new BadRequestException({
        message: 'Duplicate utility rules month',
        details: {
          field: 'chargeYearMonth',
          reason: ApiFieldReason.DUPLICATE_READING_DATE,
        },
      });
    }
    months.add(row.chargeYearMonth);
  }
}

function normalizePeriodSchemeAddons(
  addons: ReadonlyArray<{
    utility: UtilityAddon['utility'];
    name: string;
    kind: UtilityAddon['kind'];
    value: number;
    sortOrder?: number;
  }>,
): UtilityAddon[] {
  const counts: Record<string, number> = {
    [UtilityKind.ELECTRICITY]: 0,
    [UtilityKind.WATER]: 0,
  };
  const nextIndex: Record<string, number> = {
    [UtilityKind.ELECTRICITY]: 0,
    [UtilityKind.WATER]: 0,
  };
  const out: UtilityAddon[] = [];
  for (const addon of addons) {
    const utility = addon.utility;
    if (!(utility in counts)) {
      throw new BadRequestException({
        message: 'Unknown utility on add-on',
        details: {
          field: 'utilityAddons',
          reason: ApiFieldReason.UTILITY_ADDON_LIMIT,
        },
      });
    }
    counts[utility] += 1;
    let sortOrder = addon.sortOrder;
    if (sortOrder === undefined) {
      sortOrder = nextIndex[utility] ?? 0;
      nextIndex[utility] = sortOrder + 1;
    } else {
      nextIndex[utility] = Math.max(nextIndex[utility] ?? 0, sortOrder + 1);
    }
    out.push({
      utility,
      name: addon.name.trim(),
      kind: addon.kind,
      value: addon.value,
      sortOrder,
    });
  }
  if (
    (counts[UtilityKind.ELECTRICITY] ?? 0) > UTILITY_ADDON_MAX_PER_KIND ||
    (counts[UtilityKind.WATER] ?? 0) > UTILITY_ADDON_MAX_PER_KIND
  ) {
    throw new BadRequestException({
      message: `At most ${UTILITY_ADDON_MAX_PER_KIND} add-ons per utility`,
      details: {
        field: 'utilityAddons',
        reason: ApiFieldReason.UTILITY_ADDON_LIMIT,
      },
    });
  }
  return out;
}

function toPersistedPeriodScheme(
  row: UtilityPeriodScheme,
): UtilityPeriodScheme {
  return {
    chargeYearMonth: row.chargeYearMonth,
    electricityRateIdrPerKwh: Math.floor(row.electricityRateIdrPerKwh),
    waterRateIdrPerM3: Math.floor(row.waterRateIdrPerM3),
    maintenanceFeeIdrPerMonth: Math.floor(row.maintenanceFeeIdrPerMonth),
    electricityMinKwh: row.electricityMinKwh,
    adminFeeIdrPerMonth: Math.floor(row.adminFeeIdrPerMonth),
    utilityAddons: normalizePeriodSchemeAddons(row.utilityAddons),
  };
}

const reservationInclude = {
  property: { select: { name: true, timezone: true } },
  unit: { select: { code: true } },
  icalObservedUnit: { select: { code: true } },
  createdByAdmin: { select: { username: true } },
  updatedByAdmin: { select: { username: true } },
} as const;

const reservationDetailInclude = {
  ...reservationInclude,
  unitType: {
    select: {
      electricityRateIdrPerKwh: true,
      waterRateIdrPerM3: true,
      maintenanceFeeIdrPerMonth: true,
      electricityMinKwh: true,
      adminFeeIdrPerMonth: true,
      utilityAddons: {
        orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
        select: {
          utility: true,
          name: true,
          kind: true,
          value: true,
          sortOrder: true,
        },
      },
    },
  },
  movements: {
    orderBy: { createdAt: 'asc' as const },
    include: { createdByAdmin: { select: { username: true } } },
  },
  utilityReadings: {
    orderBy: [{ readingDate: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  maintenanceCharges: {
    orderBy: [{ chargeDate: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  adminCharges: {
    orderBy: [{ chargeDate: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  utilityPeriodSchemes: {
    orderBy: { chargeDate: 'asc' as const },
  },
};

type Actor = Pick<StaffAdmin, 'id'>;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly icalImportService: IcalImportService,
    @Inject(PDF_CONVERT) private readonly pdfConvert: PdfConvertPort,
  ) {}

  async list(
    query: ListReservationsQueryDto,
  ): Promise<Paginated<StaffReservationListItem>> {
    if (query.board === ReservationBoard['utilities-due']) {
      return this.listUtilitiesDue(query);
    }

    const where = await this.buildListWhere(query);

    if (query.sort === ReservationListSort.openAmount) {
      const total = await this.prisma.reservation.count({ where });
      const rows = await this.findManyOrderedByOpenAmount(
        where,
        query.page,
        query.pageSize,
      );
      return {
        items: rows.map((row) => toStaffReservationListItem(row)),
        pageInfo: buildPageInfo(query.page, query.pageSize, total),
      };
    }

    const orderBy = this.listOrderBy(query.sort, query.board);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        select: reservationListSelect,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => toStaffReservationListItem(row)),
      pageInfo: buildPageInfo(query.page, query.pageSize, total),
    };
  }

  private listOrderBy(
    sort: ReservationListSort | undefined,
    board?: ReservationBoard,
  ): Prisma.ReservationOrderByWithRelationInput[] {
    if (sort === ReservationListSort.createdAt) {
      return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
    if (board === ReservationBoard.departures) {
      return [{ checkOutDate: 'asc' }, { createdAt: 'asc' }];
    }
    return [{ checkInDate: 'asc' }, { createdAt: 'asc' }];
  }

  /**
   * Page ordered by `openAmountIdr` = max(Due, Refund) DESC.
   * Membership uses the same Prisma `where` as `count`; ORDER BY is SQL
   * (`ABS(total−paid)` when total known, else 0) — not page-then-sort in JS.
   */
  private async findManyOrderedByOpenAmount(
    where: Prisma.ReservationWhereInput,
    page: number,
    pageSize: number,
  ): Promise<
    Prisma.ReservationGetPayload<{ select: typeof reservationListSelect }>[]
  > {
    const matching = await this.prisma.reservation.findMany({
      where,
      select: { id: true },
    });
    if (matching.length === 0) {
      return [];
    }

    const skip = (page - 1) * pageSize;
    const orderedIds = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT r.id
      FROM "Reservation" r
      WHERE r.id IN (${Prisma.join(matching.map((row) => row.id))})
      ORDER BY (
        CASE
          WHEN r."totalAmountIdr" IS NULL THEN 0
          ELSE ABS(r."totalAmountIdr" - r."paidAmountIdr")
        END
      ) DESC,
      r."checkInDate" ASC,
      r.id ASC
      LIMIT ${pageSize}
      OFFSET ${skip}
    `;
    if (orderedIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.reservation.findMany({
      where: { id: { in: orderedIds.map((row) => row.id) } },
      select: reservationListSelect,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return orderedIds.flatMap((row) => {
      const hit = byId.get(row.id);
      return hit ? [hit] : [];
    });
  }

  /**
   * `utilities-due` board. Membership is a COMPUTED month-coverage predicate
   * Prisma `where` cannot express, so it is resolved by `$queryRaw` in
   * `findUtilitiesDueReservationIds` (1:1 with `computeUtilitiesDueNotice`),
   * then the true rows are paged by that ordered id set. Pagination is exact
   * (count = true rows) — no "load then filter in JS".
   */
  private async listUtilitiesDue(
    query: ListReservationsQueryDto,
  ): Promise<Paginated<StaffReservationListItem>> {
    const today = parseYmd(await this.resolveBoardToday(query.propertyId));

    const dueIds = await findUtilitiesDueReservationIds(this.prisma, {
      propertyId: query.propertyId,
      source: query.source,
      billingPeriod: query.billingPeriod,
      q: query.q,
      today,
    });
    const total = dueIds.length;
    const skip = (query.page - 1) * query.pageSize;
    const pageIds = dueIds.slice(skip, skip + query.pageSize);

    const rows =
      pageIds.length === 0
        ? []
        : await this.prisma.reservation.findMany({
            where: { id: { in: pageIds.map((row) => row.id) } },
            select: reservationListSelect,
          });
    const byId = new Map(rows.map((row) => [row.id, row]));

    return {
      items: pageIds.flatMap((row) => {
        const hit = byId.get(row.id);
        return hit ? [toStaffReservationListItem(hit)] : [];
      }),
      pageInfo: buildPageInfo(query.page, query.pageSize, total),
    };
  }

  async getById(id: string): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: reservationDetailInclude,
    });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    return toStaffReservation(row, {
      includeMovements: true,
      includeUtilities: true,
    });
  }

  async getUtilityStatementPdf(
    id: string,
    chargeYearMonth: string,
    payee: UtilityStatementPayee,
  ): Promise<{ pdf: Buffer; filename: string }> {
    const reservation = await this.getById(id);
    const input = buildUtilityStatementFillInput(
      reservation,
      chargeYearMonth,
      payee,
    );
    const xlsx = await fillUtilityStatementXlsx(input);
    const pdf = await this.pdfConvert.convertXlsxToPdf(xlsx);
    return {
      pdf,
      filename: utilityStatementFilename(reservation.unitCode, chargeYearMonth),
    };
  }

  async listUtilityStatementBankAccounts(): Promise<
    StaffUtilityStatementBankAccount[]
  > {
    const rows = await this.prisma.utilityStatementBankAccount.findMany({
      orderBy: { lastUsedAt: 'desc' },
      take: UTILITY_STATEMENT_BANK_ACCOUNT_RECENT_MAX,
    });
    return rows.map(toStaffUtilityStatementBankAccount);
  }

  async saveUtilityStatementBankAccount(
    payee: UtilityStatementPayee,
  ): Promise<StaffUtilityStatementBankAccount[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.utilityStatementBankAccount.upsert({
        where: {
          bankName_accountName_accountNumber: {
            bankName: payee.bankName,
            accountName: payee.accountName,
            accountNumber: payee.accountNumber,
          },
        },
        create: {
          bankName: payee.bankName,
          accountName: payee.accountName,
          accountNumber: payee.accountNumber,
        },
        update: { lastUsedAt: new Date() },
      });
      const extras = await tx.utilityStatementBankAccount.findMany({
        orderBy: { lastUsedAt: 'desc' },
        skip: UTILITY_STATEMENT_BANK_ACCOUNT_RECENT_MAX,
        select: { id: true },
      });
      if (extras.length > 0) {
        await tx.utilityStatementBankAccount.deleteMany({
          where: { id: { in: extras.map((row) => row.id) } },
        });
      }
    });
    return this.listUtilityStatementBankAccounts();
  }

  async create(
    dto: CreateReservationDto,
    actor: Actor,
  ): Promise<StaffReservation> {
    this.assertDateRange(dto.checkInDate, dto.checkOutDate);
    this.assertStayPeriodRange(
      dto.billingPeriod,
      dto.checkInDate,
      dto.checkOutDate,
    );

    const unit = await this.loadBookableUnit({
      propertyId: dto.propertyId,
      unitId: dto.unitId,
      unitTypeId: dto.unitTypeId,
    });

    const gaps = getConfirmFieldGaps({
      unitId: dto.unitId,
      checkInDate: dto.checkInDate,
      checkOutDate: dto.checkOutDate,
      guestName: dto.guestName,
      guestEmail: dto.guestEmail ?? null,
      guestPhone: dto.guestPhone ?? null,
      guestCount: dto.guestCount,
      rentAmountIdr: dto.rentAmountIdr,
      paidAmountIdr: 0,
      maxGuests: unit.unitType.maxGuests,
    });
    if (gaps.length > 0) {
      const overMax =
        gaps.includes('guestCount') &&
        dto.guestCount != null &&
        dto.guestCount > unit.unitType.maxGuests;
      if (overMax) {
        this.throwGuestCountExceedsMax(unit.unitType.maxGuests);
      }
      throw new BadRequestException({
        message: `Reservation is incomplete (${gaps.join(', ')})`,
        details: {
          field: gaps[0],
          reason: ApiFieldReason.CONFIRM_INCOMPLETE,
        },
      });
    }

    const inventoryEndYmd = computeInventoryEndYmd(
      dto.billingPeriod,
      dto.checkOutDate,
    );

    await this.assertNoOverlap({
      unitId: dto.unitId,
      checkInDate: dto.checkInDate,
      checkOutDate: dto.checkOutDate,
      busyEndDate: inventoryEndYmd,
    });

    const depositAmountIdr = Math.max(0, Math.floor(dto.depositAmountIdr));
    const rentAmountIdr = Math.floor(dto.rentAmountIdr);
    const quote = recomputeStayQuoteTotal({
      rentAmountIdr,
      electricityAmountIdr: 0,
      waterAmountIdr: 0,
      maintenanceAmountIdr: 0,
      adminAmountIdr: 0,
    });
    const now = new Date();

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const overlap = await findOccupyingOverlap(tx, {
          unitId: dto.unitId,
          checkInDate: dto.checkInDate,
          checkOutDate: dto.checkOutDate,
          busyEndDate: inventoryEndYmd,
        });
        if (overlap) {
          this.throwOverlap(overlap);
        }

        const reservation = await tx.reservation.create({
          data: {
            propertyId: dto.propertyId,
            unitId: dto.unitId,
            unitTypeId: dto.unitTypeId,
            source: dto.source,
            status: ReservationStatus.CONFIRMED,
            billingPeriod: dto.billingPeriod,
            checkInDate: parseYmd(dto.checkInDate),
            checkOutDate: parseYmd(dto.checkOutDate),
            inventoryEndDate: parseYmd(inventoryEndYmd),
            guestName: dto.guestName.trim(),
            guestEmail: dto.guestEmail?.trim() || null,
            guestPhone: dto.guestPhone?.trim() || null,
            guestCount: dto.guestCount,
            notes: dto.notes?.trim() || null,
            rentAmountIdr: BigInt(quote.rentAmountIdr ?? 0),
            electricityAmountIdr: BigInt(0),
            waterAmountIdr: BigInt(0),
            maintenanceAmountIdr: BigInt(0),
            electricityRateIdrPerKwh: unit.unitType.electricityRateIdrPerKwh,
            waterRateIdrPerM3: unit.unitType.waterRateIdrPerM3,
            maintenanceFeeIdrPerMonth: unit.unitType.maintenanceFeeIdrPerMonth,
            electricityMinKwh: Number(unit.unitType.electricityMinKwh ?? 0),
            adminFeeIdrPerMonth: unit.unitType.adminFeeIdrPerMonth ?? 0,
            utilityAddons: asUtilityAddons(unit.unitType.utilityAddons),
            adminAmountIdr: BigInt(0),
            totalAmountIdr: BigInt(quote.totalAmountIdr ?? 0),
            paidAmountIdr: BigInt(0),
            paymentStatus: PaymentStatus.UNPAID,
            confirmedAt: now,
            createdByAdminId: actor.id,
            updatedByAdminId: actor.id,
          },
        });

        if (depositAmountIdr > 0) {
          const signed = signedAmountFor(
            PaymentMovementDirection.IN,
            depositAmountIdr,
          );
          await tx.paymentMovement.create({
            data: {
              reservationId: reservation.id,
              direction: PaymentMovementDirection.IN,
              kind: PaymentMovementKind.DEPOSIT,
              amountIdr: BigInt(depositAmountIdr),
              signedAmount: BigInt(signed),
              method: CollectedVia.PROPERTY,
              note: 'Opening deposit on create',
              createdByAdminId: actor.id,
            },
          });
        }

        // Always recompute — complimentary total=0/paid=0 → PAID (doc §6 / §15).
        await this.syncPaidFromMovements(tx, reservation.id, {
          forceRefunded: false,
          updatedByAdminId: actor.id,
        });

        return reservation.id;
      });

      return this.getById(created);
    } catch (error: unknown) {
      this.rethrowExclusionConflict(error);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateReservationDto,
    actor: Actor,
  ): Promise<StaffReservation> {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { property: { select: { timezone: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Reservation not found');
    }
    if (
      existing.status === ReservationStatus.CANCELLED ||
      existing.status === ReservationStatus.CHECKED_OUT
    ) {
      throw new BadRequestException({
        message: 'Terminal reservation cannot be edited',
        details: {
          field: 'status',
          reason: ApiFieldReason.INVALID_STATUS_TRANSITION,
        },
      });
    }

    if (
      dto.source !== undefined &&
      dto.source !== existing.source &&
      existing.externalRef != null
    ) {
      throw new BadRequestException({
        message:
          'Source is locked while this stay is linked to an OTA calendar UID',
        details: {
          field: 'source',
          reason: ApiFieldReason.SOURCE_LOCKED_WITH_EXTERNAL_REF,
        },
      });
    }

    const checkInDate = dto.checkInDate ?? this.ymd(existing.checkInDate);
    const checkOutDate = dto.checkOutDate ?? this.ymd(existing.checkOutDate);
    const billingPeriod: StayBillingPeriodType =
      dto.billingPeriod ?? existing.billingPeriod;
    this.assertDateRange(checkInDate, checkOutDate);
    this.assertStayPeriodRange(billingPeriod, checkInDate, checkOutDate);

    const unitId = dto.unitId ?? existing.unitId;
    const unitTypeId = dto.unitTypeId ?? existing.unitTypeId;

    const inventoryEndYmd = computeInventoryEndYmd(billingPeriod, checkOutDate);
    const inventoryTouched = Boolean(
      dto.unitId ||
      dto.checkInDate ||
      dto.checkOutDate ||
      dto.billingPeriod !== undefined,
    );

    let maxGuests: number | null = null;
    if (dto.unitId || dto.unitTypeId || dto.checkInDate || dto.checkOutDate) {
      const unit = await this.loadBookableUnit({
        propertyId: existing.propertyId,
        unitId,
        unitTypeId,
      });
      maxGuests = unit.unitType.maxGuests;
    } else if (dto.guestCount !== undefined) {
      const unitType = await this.prisma.unitType.findUnique({
        where: { id: unitTypeId },
        select: { maxGuests: true },
      });
      maxGuests = unitType?.maxGuests ?? null;
    }

    if (inventoryTouched) {
      await this.assertNoOverlap({
        unitId,
        checkInDate,
        checkOutDate,
        busyEndDate: inventoryEndYmd,
        excludeReservationId: id,
      });
    }

    const nextGuestCount =
      dto.guestCount !== undefined ? dto.guestCount : existing.guestCount;
    if (
      maxGuests != null &&
      nextGuestCount != null &&
      nextGuestCount > maxGuests
    ) {
      this.throwGuestCountExceedsMax(maxGuests);
    }

    const occupancyTouched = Boolean(
      dto.unitId || dto.checkInDate || dto.checkOutDate,
    );
    const icalClear = await this.resolveIcalWarningClearOnUpdate({
      existing,
      unitId,
      checkInDate,
      checkOutDate,
      occupancyTouched,
      datesTouched: Boolean(dto.checkInDate || dto.checkOutDate),
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        if (inventoryTouched) {
          const overlap = await findOccupyingOverlap(tx, {
            unitId,
            checkInDate,
            checkOutDate,
            busyEndDate: inventoryEndYmd,
            excludeReservationId: id,
          });
          if (overlap) {
            this.throwOverlap(overlap);
          }
        }

        await tx.reservation.update({
          where: { id },
          data: {
            ...(dto.unitId !== undefined ? { unitId: dto.unitId } : {}),
            ...(dto.unitTypeId !== undefined
              ? { unitTypeId: dto.unitTypeId }
              : {}),
            ...(dto.billingPeriod !== undefined
              ? { billingPeriod: dto.billingPeriod }
              : {}),
            ...(dto.checkInDate !== undefined
              ? { checkInDate: parseYmd(dto.checkInDate) }
              : {}),
            ...(dto.checkOutDate !== undefined
              ? { checkOutDate: parseYmd(dto.checkOutDate) }
              : {}),
            ...(inventoryTouched
              ? { inventoryEndDate: parseYmd(inventoryEndYmd) }
              : {}),
            ...(dto.guestName !== undefined
              ? { guestName: dto.guestName.trim() }
              : {}),
            ...(dto.guestEmail !== undefined
              ? { guestEmail: dto.guestEmail?.trim() || null }
              : {}),
            ...(dto.guestPhone !== undefined
              ? { guestPhone: dto.guestPhone?.trim() || null }
              : {}),
            ...(dto.guestCount !== undefined
              ? { guestCount: dto.guestCount }
              : {}),
            ...(dto.notes !== undefined
              ? { notes: dto.notes?.trim() || null }
              : {}),
            ...(dto.rentAmountIdr !== undefined
              ? (() => {
                  const rentAmountIdr =
                    dto.rentAmountIdr == null
                      ? null
                      : Math.floor(dto.rentAmountIdr);
                  const quote = recomputeStayQuoteTotal({
                    rentAmountIdr,
                    electricityAmountIdr: Number(existing.electricityAmountIdr),
                    waterAmountIdr: Number(existing.waterAmountIdr),
                    maintenanceAmountIdr: Number(existing.maintenanceAmountIdr),
                    adminAmountIdr: Number(existing.adminAmountIdr ?? 0),
                  });
                  return {
                    rentAmountIdr:
                      quote.rentAmountIdr == null
                        ? null
                        : BigInt(quote.rentAmountIdr),
                    totalAmountIdr:
                      quote.totalAmountIdr == null
                        ? null
                        : BigInt(quote.totalAmountIdr),
                  };
                })()
              : {}),
            ...(dto.source !== undefined ? { source: dto.source } : {}),
            ...(icalClear.clearWarning
              ? {
                  icalSyncWarning: null,
                  icalSyncWarnedAt: null,
                  icalObservedUnitId: null,
                  icalObservedCheckInDate: null,
                  icalObservedCheckOutDate: null,
                }
              : {}),
            ...(icalClear.clearOverlapHold ? { icalOverlapHold: false } : {}),
            updatedByAdminId: actor.id,
          },
        });

        if (dto.rentAmountIdr !== undefined) {
          await this.syncPaidFromMovements(tx, id, {
            forceRefunded: false,
            updatedByAdminId: actor.id,
          });
        }
      });
    } catch (error: unknown) {
      this.rethrowExclusionConflict(error);
      throw error;
    }

    return this.getById(id);
  }

  async acceptIcalDates(id: string, actor: Actor): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    if (row.icalSyncWarning !== IcalSyncWarning.DATES_DIFFER) {
      throw new BadRequestException(
        'Reservation has no OTA date-change warning to accept',
      );
    }
    if (!row.externalRef) {
      throw new BadRequestException('Reservation has no iCal external ref');
    }

    const dates = await this.icalImportService.fetchEventDatesForUid({
      unitId: row.unitId,
      propertyId: row.propertyId,
      source: row.source,
      externalRef: row.externalRef,
    });
    if (dates.kind !== 'found') {
      throw new BadRequestException(
        dates.kind === 'incomplete'
          ? 'Could not re-fetch OTA dates (feed error) — try Sync all or check the unit feed URL'
          : 'Could not re-fetch OTA dates for this booking — check the unit feed URL',
      );
    }

    this.assertDateRange(dates.checkInDate, dates.checkOutDate);
    const inventoryEndYmd = computeInventoryEndYmd(
      row.billingPeriod,
      dates.checkOutDate,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        const overlap = await findOccupyingOverlap(tx, {
          unitId: row.unitId,
          checkInDate: dates.checkInDate,
          checkOutDate: dates.checkOutDate,
          busyEndDate: inventoryEndYmd,
          excludeReservationId: id,
        });
        if (overlap) {
          this.throwOverlap(overlap);
        }

        await tx.reservation.update({
          where: { id },
          data: {
            checkInDate: parseYmd(dates.checkInDate),
            checkOutDate: parseYmd(dates.checkOutDate),
            inventoryEndDate: parseYmd(inventoryEndYmd),
            icalSyncWarning: null,
            icalSyncWarnedAt: null,
            icalObservedUnitId: null,
            icalObservedCheckInDate: null,
            icalObservedCheckOutDate: null,
            updatedByAdminId: actor.id,
          },
        });
      });
    } catch (error: unknown) {
      this.rethrowExclusionConflict(error);
      throw error;
    }

    return this.getById(id);
  }

  async acceptIcalUnit(id: string, actor: Actor): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    if (row.icalSyncWarning !== IcalSyncWarning.UNIT_DIFFER) {
      throw new BadRequestException(
        'Reservation has no OTA unit-move warning to accept',
      );
    }
    if (!row.externalRef) {
      throw new BadRequestException('Reservation has no iCal external ref');
    }

    let targetUnitId = row.icalObservedUnitId;
    let otaCheckIn =
      row.icalObservedCheckInDate != null
        ? this.ymd(row.icalObservedCheckInDate)
        : null;
    let otaCheckOut =
      row.icalObservedCheckOutDate != null
        ? this.ymd(row.icalObservedCheckOutDate)
        : null;

    if (!targetUnitId || !otaCheckIn || !otaCheckOut) {
      const located = await this.icalImportService.fetchEventDatesForUid({
        unitId: row.unitId,
        propertyId: row.propertyId,
        source: row.source,
        externalRef: row.externalRef,
      });
      if (located.kind !== 'found' || located.unitId === row.unitId) {
        throw new BadRequestException(
          located.kind === 'incomplete'
            ? 'Could not look up this booking on another unit feed (feed error) — try Sync all'
            : 'Could not find this booking on another unit feed — check OTA URLs or Sync all',
        );
      }
      targetUnitId = located.unitId;
      otaCheckIn = located.checkInDate;
      otaCheckOut = located.checkOutDate;
    }

    if (!targetUnitId || !otaCheckIn || !otaCheckOut) {
      throw new BadRequestException(
        'Could not resolve OTA unit/dates for this booking — try Sync all',
      );
    }

    const observedCheckIn = otaCheckIn;
    const observedCheckOut = otaCheckOut;

    const target = await this.prisma.unit.findUnique({
      where: { id: targetUnitId },
      include: {
        property: { select: { id: true, isActive: true } },
        unitType: { select: { id: true, isActive: true } },
      },
    });
    if (!target || target.propertyId !== row.propertyId) {
      throw new BadRequestException({
        message: 'Observed OTA unit is missing or not on this property',
        details: {
          field: 'unitId',
          reason: ApiFieldReason.UNIT_NOT_BOOKABLE,
        },
      });
    }
    if (
      !target.property.isActive ||
      !target.unitType.isActive ||
      !isUnitStatusBookable(target.status)
    ) {
      throw new BadRequestException({
        message: 'Observed OTA unit is not bookable',
        details: {
          field: 'unitId',
          reason: ApiFieldReason.UNIT_NOT_BOOKABLE,
        },
      });
    }

    const checkInDate = this.ymd(row.checkInDate);
    const checkOutDate = this.ymd(row.checkOutDate);
    const inventoryEndYmd = computeInventoryEndYmd(
      row.billingPeriod,
      checkOutDate,
    );
    const datesStillDiffer =
      observedCheckIn !== checkInDate || observedCheckOut !== checkOutDate;

    try {
      await this.prisma.$transaction(async (tx) => {
        const overlap = await findOccupyingOverlap(tx, {
          unitId: target.id,
          checkInDate,
          checkOutDate,
          busyEndDate: inventoryEndYmd,
          excludeReservationId: id,
        });
        if (overlap) {
          this.throwOverlap(overlap);
        }

        await tx.reservation.update({
          where: { id },
          data: {
            unitId: target.id,
            unitTypeId: target.unitTypeId,
            inventoryEndDate: parseYmd(inventoryEndYmd),
            icalOverlapHold: false,
            updatedByAdminId: actor.id,
            ...(datesStillDiffer
              ? {
                  icalSyncWarning: IcalSyncWarning.DATES_DIFFER,
                  icalSyncWarnedAt: new Date(),
                  icalObservedUnitId: null,
                  icalObservedCheckInDate: parseYmd(observedCheckIn),
                  icalObservedCheckOutDate: parseYmd(observedCheckOut),
                }
              : {
                  icalSyncWarning: null,
                  icalSyncWarnedAt: null,
                  icalObservedUnitId: null,
                  icalObservedCheckInDate: null,
                  icalObservedCheckOutDate: null,
                }),
          },
        });
      });
    } catch (error: unknown) {
      this.rethrowExclusionConflict(error);
      throw error;
    }

    return this.getById(id);
  }

  async dismissIcalWarning(
    id: string,
    actor: Actor,
  ): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    if (!row.icalSyncWarning) {
      throw new BadRequestException('Reservation has no iCal warning');
    }

    if (row.icalSyncWarning === IcalSyncWarning.IMPORT_OVERLAP) {
      const checkOutDate = this.ymd(row.checkOutDate);
      await this.assertNoOverlap({
        unitId: row.unitId,
        checkInDate: this.ymd(row.checkInDate),
        checkOutDate,
        busyEndDate: computeInventoryEndYmd(row.billingPeriod, checkOutDate),
        excludeReservationId: id,
      });
      await this.prisma.reservation.update({
        where: { id },
        data: {
          icalSyncWarning: null,
          icalSyncWarnedAt: null,
          icalOverlapHold: false,
          inventoryEndDate: parseYmd(
            computeInventoryEndYmd(row.billingPeriod, checkOutDate),
          ),
          icalObservedUnitId: null,
          icalObservedCheckInDate: null,
          icalObservedCheckOutDate: null,
          updatedByAdminId: actor.id,
        },
      });
      return this.getById(id);
    }

    await this.prisma.reservation.update({
      where: { id },
      data: {
        icalSyncWarning: null,
        icalSyncWarnedAt: null,
        icalObservedUnitId: null,
        icalObservedCheckInDate: null,
        icalObservedCheckOutDate: null,
        ...(row.icalSyncWarning === IcalSyncWarning.OTA_STILL_LISTED
          ? { icalOtaStillListedDismissedAt: new Date() }
          : {}),
        updatedByAdminId: actor.id,
      },
    });

    return this.getById(id);
  }

  async confirm(id: string, actor: Actor): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        unitType: { select: { maxGuests: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    if (row.status !== ReservationStatus.UNCONFIRMED) {
      throw new BadRequestException({
        message: 'Only UNCONFIRMED can be confirmed',
        details: {
          field: 'status',
          reason: ApiFieldReason.INVALID_STATUS_TRANSITION,
        },
      });
    }

    const gaps = getConfirmFieldGaps({
      unitId: row.unitId,
      checkInDate: this.ymd(row.checkInDate),
      checkOutDate: this.ymd(row.checkOutDate),
      guestName: row.guestName,
      guestEmail: row.guestEmail,
      guestPhone: row.guestPhone,
      guestCount: row.guestCount,
      rentAmountIdr:
        row.rentAmountIdr == null ? null : Number(row.rentAmountIdr),
      paidAmountIdr: Number(row.paidAmountIdr),
      maxGuests: row.unitType.maxGuests,
    });
    if (gaps.length > 0) {
      const overMax =
        gaps.includes('guestCount') &&
        row.guestCount != null &&
        row.guestCount > row.unitType.maxGuests;
      if (overMax) {
        this.throwGuestCountExceedsMax(row.unitType.maxGuests);
      }
      throw new BadRequestException({
        message: `Reservation is incomplete (${gaps.join(', ')})`,
        details: {
          field: gaps[0],
          reason: ApiFieldReason.CONFIRM_INCOMPLETE,
        },
      });
    }

    await this.assertNoOverlap({
      unitId: row.unitId,
      checkInDate: this.ymd(row.checkInDate),
      checkOutDate: this.ymd(row.checkOutDate),
      busyEndDate: computeInventoryEndYmd(
        row.billingPeriod,
        this.ymd(row.checkOutDate),
      ),
      excludeReservationId: id,
    });

    await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CONFIRMED,
        guestName: row.guestName.trim(),
        confirmedAt: new Date(),
        icalOverlapHold: false,
        inventoryEndDate: parseYmd(
          computeInventoryEndYmd(row.billingPeriod, this.ymd(row.checkOutDate)),
        ),
        ...(row.icalSyncWarning === IcalSyncWarning.IMPORT_OVERLAP
          ? { icalSyncWarning: null, icalSyncWarnedAt: null }
          : {}),
        updatedByAdminId: actor.id,
      },
    });

    return this.getById(id);
  }

  async checkIn(
    id: string,
    dto: ConfirmEarlyDto,
    actor: Actor,
  ): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: { property: { select: { timezone: true } } },
    });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    if (row.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException({
        message: 'Only CONFIRMED can check in',
        details: {
          field: 'status',
          reason: ApiFieldReason.INVALID_STATUS_TRANSITION,
        },
      });
    }

    const today = todayYmdInTimezone(row.property.timezone);
    const checkIn = this.ymd(row.checkInDate);
    const checkOut = this.ymd(row.checkOutDate);
    const inWindow = checkIn <= today && today < checkOut;
    if (!inWindow && !dto.confirmEarly) {
      throw new BadRequestException({
        message: 'Early check-in requires confirmEarly',
        details: {
          field: 'confirmEarly',
          reason: ApiFieldReason.EARLY_CONFIRM_REQUIRED,
        },
      });
    }

    await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CHECKED_IN,
        checkedInAt: new Date(),
        updatedByAdminId: actor.id,
      },
    });

    return this.getById(id);
  }

  async checkOut(
    id: string,
    dto: ConfirmEarlyDto,
    actor: Actor,
  ): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: { property: { select: { timezone: true } } },
    });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    if (row.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException({
        message: 'Only CHECKED_IN can check out',
        details: {
          field: 'status',
          reason: ApiFieldReason.INVALID_STATUS_TRANSITION,
        },
      });
    }

    const today = todayYmdInTimezone(row.property.timezone);
    const checkOut = this.ymd(row.checkOutDate);
    const isCheckoutDay = today === checkOut;
    if (!isCheckoutDay && !dto.confirmEarly) {
      throw new BadRequestException({
        message:
          today < checkOut
            ? 'Early check-out requires confirmEarly'
            : 'Late check-out requires confirmEarly',
        details: {
          field: 'confirmEarly',
          reason: ApiFieldReason.EARLY_CONFIRM_REQUIRED,
        },
      });
    }

    await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CHECKED_OUT,
        checkedOutAt: new Date(),
        inventoryEndDate: row.checkOutDate,
        updatedByAdminId: actor.id,
      },
    });

    return this.getById(id);
  }

  async cancel(
    id: string,
    dto: CancelReservationDto,
    actor: Actor,
  ): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    if (
      row.status === ReservationStatus.CHECKED_OUT ||
      row.status === ReservationStatus.CANCELLED
    ) {
      throw new BadRequestException({
        message: 'Terminal reservation cannot be cancelled',
        details: {
          field: 'status',
          reason: ApiFieldReason.INVALID_STATUS_TRANSITION,
        },
      });
    }

    const paid = Number(row.paidAmountIdr);
    const disposition = dto.disposition ?? CancelDisposition.none;
    if (paid > 0 && disposition === CancelDisposition.none) {
      throw new BadRequestException({
        message: 'Choose a refund disposition: full_refund, keep, or partial',
        details: {
          field: 'disposition',
          reason: ApiFieldReason.CANCEL_DISPOSITION_REQUIRED,
        },
      });
    }

    let forceRefunded = false;

    await this.prisma.$transaction(async (tx) => {
      if (disposition === CancelDisposition.full_refund && paid > 0) {
        const signed = signedAmountFor(PaymentMovementDirection.OUT, paid);
        await tx.paymentMovement.create({
          data: {
            reservationId: id,
            direction: PaymentMovementDirection.OUT,
            kind: PaymentMovementKind.CANCEL_REFUND,
            amountIdr: BigInt(paid),
            signedAmount: BigInt(signed),
            method: row.collectedVia,
            note: 'Cancel: full refund',
            createdByAdminId: actor.id,
          },
        });
        forceRefunded = true;
      } else if (disposition === CancelDisposition.partial) {
        const refundAmountIdr = Math.floor(dto.refundAmountIdr ?? Number.NaN);
        if (!Number.isFinite(refundAmountIdr) || refundAmountIdr <= 0) {
          throw new BadRequestException({
            message: 'Partial refund requires refundAmountIdr > 0',
            details: {
              field: 'refundAmountIdr',
              reason: ApiFieldReason.REFUND_AMOUNT_INVALID,
            },
          });
        }
        if (refundAmountIdr >= paid) {
          throw new BadRequestException({
            message:
              'Partial refund must be less than Paid — use full_refund to return all',
            details: {
              field: 'refundAmountIdr',
              reason: ApiFieldReason.REFUND_AMOUNT_INVALID,
            },
          });
        }
        const signed = signedAmountFor(
          PaymentMovementDirection.OUT,
          refundAmountIdr,
        );
        await tx.paymentMovement.create({
          data: {
            reservationId: id,
            direction: PaymentMovementDirection.OUT,
            kind: PaymentMovementKind.CANCEL_REFUND,
            amountIdr: BigInt(refundAmountIdr),
            signedAmount: BigInt(signed),
            method: row.collectedVia,
            note: 'Cancel: partial refund',
            createdByAdminId: actor.id,
          },
        });
      }

      await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CANCELLED,
          cancelledAt: new Date(),
          inventoryEndDate: row.checkOutDate,
          // Desk resolved via Cancel; sync may set OTA_STILL_LISTED if UID returns.
          icalSyncWarning: null,
          icalSyncWarnedAt: null,
          icalOverlapHold: false,
          icalObservedUnitId: null,
          icalObservedCheckInDate: null,
          icalObservedCheckOutDate: null,
          ...(dto.notes !== undefined
            ? { notes: dto.notes?.trim() || null }
            : {}),
          updatedByAdminId: actor.id,
        },
      });

      await this.syncPaidFromMovements(tx, id, {
        forceRefunded,
        updatedByAdminId: actor.id,
      });
    });

    return this.getById(id);
  }

  async postMovement(
    id: string,
    dto: PostPaymentMovementDto,
    actor: Actor,
  ): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    if (row.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'Cannot collect on a cancelled reservation',
        details: {
          field: 'status',
          reason: ApiFieldReason.INVALID_STATUS_TRANSITION,
        },
      });
    }

    const amountIdr = Math.floor(dto.amountIdr);
    if (!Number.isFinite(amountIdr) || amountIdr <= 0) {
      throw new BadRequestException({
        message: 'Amount must be > 0',
        details: {
          field: 'amountIdr',
          reason: ApiFieldReason.MOVEMENT_EXCEEDS_DUE,
        },
      });
    }

    const total =
      row.totalAmountIdr == null ? null : Number(row.totalAmountIdr);
    const paid = Number(row.paidAmountIdr);

    if (dto.direction === PaymentMovementDirection.IN) {
      if (total == null) {
        throw new BadRequestException({
          message: 'Set Total on the reservation before collecting',
          details: {
            field: 'totalAmountIdr',
            reason: ApiFieldReason.CONFIRM_INCOMPLETE,
          },
        });
      }
    } else {
      const refund = refundDueIdr(total, paid);
      const maxOut = refund != null && refund > 0 ? refund : paid;
      if (amountIdr > maxOut) {
        throw new BadRequestException({
          message: `Refund cannot exceed ${maxOut}`,
          details: {
            field: 'amountIdr',
            reason: ApiFieldReason.MOVEMENT_EXCEEDS_DUE,
          },
        });
      }
    }

    const signed = signedAmountFor(dto.direction, amountIdr);

    await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockReservationForCash(tx, id);
      if (!locked) {
        throw new NotFoundException('Reservation not found');
      }
      if (locked.status === ReservationStatus.CANCELLED) {
        throw new BadRequestException({
          message: 'Cannot collect on a cancelled reservation',
          details: {
            field: 'status',
            reason: ApiFieldReason.INVALID_STATUS_TRANSITION,
          },
        });
      }
      await tx.paymentMovement.create({
        data: {
          reservationId: id,
          direction: dto.direction,
          kind: dto.kind,
          amountIdr: BigInt(amountIdr),
          signedAmount: BigInt(signed),
          method: dto.method ?? null,
          note: dto.note?.trim() || null,
          proofImages:
            (dto.proofImages as unknown as Prisma.InputJsonValue) ?? [],
          createdByAdminId: actor.id,
        },
      });
      await this.syncPaidFromMovements(tx, id, {
        forceRefunded: false,
        updatedByAdminId: actor.id,
      });
    });

    return this.getById(id);
  }

  async patchMovementProofs(
    id: string,
    movementId: string,
    dto: PatchPaymentMovementProofsDto,
  ): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }

    const movement = await this.prisma.paymentMovement.findFirst({
      where: { id: movementId, reservationId: id },
      select: { id: true },
    });
    if (!movement) {
      throw new NotFoundException('Payment movement not found');
    }

    await this.prisma.paymentMovement.update({
      where: { id: movementId },
      data: {
        proofImages: dto.proofImages as unknown as Prisma.InputJsonValue,
      },
    });

    return this.getById(id);
  }

  async undoMovement(
    id: string,
    movementId: string,
    actor: Actor,
  ): Promise<StaffReservation> {
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockReservationForCash(tx, id);
      if (!row) {
        throw new NotFoundException('Reservation not found');
      }

      const movement = await tx.paymentMovement.findFirst({
        where: { id: movementId, reservationId: id },
      });
      if (!movement) {
        throw new NotFoundException('Payment movement not found');
      }

      const latest = await tx.paymentMovement.findFirst({
        where: { reservationId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      });

      if (
        !canUndoPaymentMovement({
          movementId,
          createdAt: movement.createdAt,
          latestId: latest?.id ?? null,
          reservationStatus: row.status,
        })
      ) {
        if (row.status === ReservationStatus.CANCELLED) {
          throw new BadRequestException({
            message: 'Cannot undo cash on a cancelled reservation',
            details: {
              field: 'status',
              reason: ApiFieldReason.INVALID_STATUS_TRANSITION,
            },
          });
        }
        if (latest?.id !== movementId) {
          throw new BadRequestException(
            'Only the latest cash movement can be undone',
          );
        }
        throw new BadRequestException(
          'This collection can no longer be undone',
        );
      }

      await tx.paymentMovement.delete({ where: { id: movementId } });
      await this.syncPaidFromMovements(tx, id, {
        forceRefunded: false,
        updatedByAdminId: actor.id,
      });
    });

    return this.getById(id);
  }

  async putUtilities(
    id: string,
    dto: PutReservationUtilitiesDto,
    actor: Actor,
  ): Promise<StaffReservation> {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Reservation not found');
    }
    if (existing.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'Cannot edit utilities on a cancelled reservation',
        details: {
          field: 'status',
          reason: ApiFieldReason.INVALID_STATUS_TRANSITION,
        },
      });
    }

    const electricityRateIdrPerKwh =
      dto.electricityRateIdrPerKwh ?? existing.electricityRateIdrPerKwh;
    const waterRateIdrPerM3 =
      dto.waterRateIdrPerM3 ?? existing.waterRateIdrPerM3;
    const maintenanceFeeIdrPerMonth =
      dto.maintenanceFeeIdrPerMonth ?? existing.maintenanceFeeIdrPerMonth;

    const snapshot = await this.resolveUtilitySnapshot({
      ...existing,
      electricityRateIdrPerKwh,
      waterRateIdrPerM3,
      maintenanceFeeIdrPerMonth,
    });

    const elecReadings = dto.electricityReadings.map((r) => ({
      readingDate: r.readingDate,
      meterValue: r.meterValue,
    }));
    const waterReadings = dto.waterReadings.map((r) => ({
      readingDate: r.readingDate,
      meterValue: r.meterValue,
    }));
    try {
      assertMeterChain(elecReadings);
      assertMeterChain(waterReadings);
    } catch (error: unknown) {
      throwMeterError(error);
    }

    const normalizedMaint = dto.maintenanceCharges.map((c) => ({
      ...c,
      chargeDate: normalizeMaintenanceChargeDateYmd(c.chargeDate),
    }));
    uniqueChargeMonthsOrThrow(normalizedMaint, 'Duplicate maintenance month');

    const normalizedAdmin = dto.adminCharges.map((c) => ({
      ...c,
      chargeDate: normalizeMaintenanceChargeDateYmd(c.chargeDate),
    }));
    uniqueChargeMonthsOrThrow(normalizedAdmin, 'Duplicate admin month');

    const reconstructed = reconstructUtilityPeriods({
      checkInDate: existing.checkInDate.toISOString().slice(0, 10),
      utilityReadings: [
        ...dto.electricityReadings.map((r) => ({
          utility: UtilityKind.ELECTRICITY,
          readingDate: r.readingDate,
          meterValue: r.meterValue,
        })),
        ...dto.waterReadings.map((r) => ({
          utility: UtilityKind.WATER,
          readingDate: r.readingDate,
          meterValue: r.meterValue,
        })),
      ],
      maintenanceCharges: normalizedMaint,
      adminCharges: normalizedAdmin,
    });

    let persistable: UtilityPeriodScheme[];
    if (dto.periodSchemes != null) {
      uniqueSchemeMonthsOrThrow(dto.periodSchemes);
      persistable = dto.periodSchemes.map((row) =>
        toPersistedPeriodScheme({
          chargeYearMonth: row.chargeYearMonth,
          electricityRateIdrPerKwh: row.electricityRateIdrPerKwh,
          waterRateIdrPerM3: row.waterRateIdrPerM3,
          maintenanceFeeIdrPerMonth: row.maintenanceFeeIdrPerMonth,
          electricityMinKwh: row.electricityMinKwh,
          adminFeeIdrPerMonth: row.adminFeeIdrPerMonth,
          utilityAddons: row.utilityAddons.map((addon) => ({
            utility: addon.utility,
            name: addon.name,
            kind: addon.kind,
            value: addon.value,
            sortOrder: addon.sortOrder ?? 0,
          })),
        }),
      );
    } else {
      persistable = reconstructed
        .filter((period) => period.chargeYearMonth.length > 0)
        .map((period) => ({
          chargeYearMonth: period.chargeYearMonth,
          ...snapshot,
        }));
    }

    let electricityAmountIdr = 0;
    let waterAmountIdr = 0;
    try {
      for (const period of reconstructed) {
        const scheme = lookupUtilityPeriodScheme(
          persistable,
          period.chargeYearMonth,
          snapshot,
        );
        const billed = billUtilityPeriodMeters(period, scheme);
        electricityAmountIdr += billed.electricityAmountIdr;
        waterAmountIdr += billed.waterAmountIdr;
      }
    } catch (error: unknown) {
      throwMeterError(error);
    }

    let maintenanceAmountIdr = 0;
    let adminAmountIdr = 0;
    try {
      maintenanceAmountIdr = sumMaintenanceChargesIdr(normalizedMaint);
      adminAmountIdr = sumAdminChargesIdr(normalizedAdmin);
    } catch {
      throw new BadRequestException({
        message: 'Invalid fee amount',
        details: {
          field: 'amountIdr',
          reason: ApiFieldReason.REFUND_AMOUNT_INVALID,
        },
      });
    }

    const rentAmountIdr =
      existing.rentAmountIdr == null ? null : Number(existing.rentAmountIdr);
    const quote = recomputeStayQuoteTotal({
      rentAmountIdr,
      electricityAmountIdr,
      waterAmountIdr,
      maintenanceAmountIdr,
      adminAmountIdr,
    });

    const elecRows = dto.electricityReadings.map((r) => ({
      reservationId: id,
      utility: UtilityKind.ELECTRICITY,
      readingDate: parseYmd(r.readingDate),
      meterValue: r.meterValue,
      proofImages: (r.proofImages as unknown as Prisma.InputJsonValue) ?? [],
      createdByAdminId: actor.id,
    }));
    const waterRows = dto.waterReadings.map((r) => ({
      reservationId: id,
      utility: UtilityKind.WATER,
      readingDate: parseYmd(r.readingDate),
      meterValue: r.meterValue,
      proofImages: (r.proofImages as unknown as Prisma.InputJsonValue) ?? [],
      createdByAdminId: actor.id,
    }));
    const maintRows = normalizedMaint.map((c) => ({
      reservationId: id,
      chargeDate: parseYmd(c.chargeDate),
      amountIdr: BigInt(Math.floor(c.amountIdr)),
      createdByAdminId: actor.id,
    }));
    const adminRows = normalizedAdmin.map((c) => ({
      reservationId: id,
      chargeDate: parseYmd(c.chargeDate),
      amountIdr: BigInt(Math.floor(c.amountIdr)),
      createdByAdminId: actor.id,
    }));
    const schemeRows = persistable.map((scheme) => ({
      reservationId: id,
      chargeDate: parseYmd(yearMonthToChargeDateYmd(scheme.chargeYearMonth)),
      electricityRateIdrPerKwh: scheme.electricityRateIdrPerKwh,
      waterRateIdrPerM3: scheme.waterRateIdrPerM3,
      maintenanceFeeIdrPerMonth: scheme.maintenanceFeeIdrPerMonth,
      electricityMinKwh: scheme.electricityMinKwh,
      adminFeeIdrPerMonth: scheme.adminFeeIdrPerMonth,
      utilityAddons: scheme.utilityAddons,
    }));
    const denorm =
      persistable.length > 0
        ? [...persistable].sort((a, b) =>
            a.chargeYearMonth.localeCompare(b.chargeYearMonth),
          )[persistable.length - 1]
        : snapshot;

    await this.prisma.$transaction(async (tx) => {
      await tx.reservationUtilityReading.deleteMany({
        where: { reservationId: id },
      });
      await tx.reservationMaintenanceCharge.deleteMany({
        where: { reservationId: id },
      });
      await tx.reservationAdminCharge.deleteMany({
        where: { reservationId: id },
      });
      await tx.reservationUtilityPeriodScheme.deleteMany({
        where: { reservationId: id },
      });
      if (elecRows.length > 0) {
        await tx.reservationUtilityReading.createMany({ data: elecRows });
      }
      if (waterRows.length > 0) {
        await tx.reservationUtilityReading.createMany({ data: waterRows });
      }
      if (maintRows.length > 0) {
        await tx.reservationMaintenanceCharge.createMany({ data: maintRows });
      }
      if (adminRows.length > 0) {
        await tx.reservationAdminCharge.createMany({ data: adminRows });
      }
      if (schemeRows.length > 0) {
        await tx.reservationUtilityPeriodScheme.createMany({
          data: schemeRows,
        });
      }
      await tx.reservation.update({
        where: { id },
        data: {
          electricityRateIdrPerKwh: denorm.electricityRateIdrPerKwh,
          waterRateIdrPerM3: denorm.waterRateIdrPerM3,
          maintenanceFeeIdrPerMonth: denorm.maintenanceFeeIdrPerMonth,
          electricityMinKwh: denorm.electricityMinKwh,
          adminFeeIdrPerMonth: denorm.adminFeeIdrPerMonth,
          utilityAddons: denorm.utilityAddons,
          electricityAmountIdr: BigInt(electricityAmountIdr),
          waterAmountIdr: BigInt(waterAmountIdr),
          maintenanceAmountIdr: BigInt(maintenanceAmountIdr),
          adminAmountIdr: BigInt(adminAmountIdr),
          totalAmountIdr:
            quote.totalAmountIdr == null ? null : BigInt(quote.totalAmountIdr),
          updatedByAdminId: actor.id,
        },
      });
      await this.syncPaidFromMovements(tx, id, {
        forceRefunded: false,
        updatedByAdminId: actor.id,
      });
    });

    return this.getById(id);
  }

  /**
   * Serialize cash writes on one stay. Collect inserts a movement before it
   * updates Reservation; without this lock, undo can still see the old latest.
   */
  private async lockReservationForCash(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<{ id: string; status: ReservationStatus } | null> {
    const rows = await tx.$queryRaw<
      Array<{ id: string; status: ReservationStatus }>
    >`
      SELECT id, status
      FROM "Reservation"
      WHERE id = ${id}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  private async syncPaidFromMovements(
    tx: Prisma.TransactionClient,
    reservationId: string,
    opts: { forceRefunded: boolean; updatedByAdminId: string },
  ): Promise<void> {
    const movements = await tx.paymentMovement.findMany({
      where: { reservationId },
      select: { signedAmount: true, method: true },
      orderBy: { createdAt: 'asc' },
    });
    const paidAmountIdr = sumPaidFromMovements(
      movements.map((m) => ({ signedAmount: Number(m.signedAmount) })),
    );
    const reservation = await tx.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: { totalAmountIdr: true },
    });
    const total =
      reservation.totalAmountIdr == null
        ? null
        : Number(reservation.totalAmountIdr);
    const paymentStatus = recomputePaymentStatus({
      totalAmountIdr: total,
      paidAmountIdr,
      forceRefunded: opts.forceRefunded,
    });

    let collectedVia: CollectedVia | null = null;
    for (let i = movements.length - 1; i >= 0; i -= 1) {
      const method = movements[i]?.method;
      if (method) {
        collectedVia = method;
        break;
      }
    }

    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        paidAmountIdr: BigInt(paidAmountIdr),
        paymentStatus,
        collectedVia,
        updatedByAdminId: opts.updatedByAdminId,
      },
    });
  }

  /**
   * Stay-level fallback. Empty `utilityAddons` means not yet copied
   * (iCal stub / pre-wave row) — take current unit-type add-ons, plus min kWh
   * and admin default when those are still 0. Later unit-type edits do not
   * change a non-empty snapshot. Rates stay on the reservation.
   */
  private async resolveUtilitySnapshot(existing: {
    unitTypeId: string;
    electricityRateIdrPerKwh: number;
    waterRateIdrPerM3: number;
    maintenanceFeeIdrPerMonth: number;
    electricityMinKwh: unknown;
    adminFeeIdrPerMonth: number;
    utilityAddons: unknown;
  }): Promise<UtilitySchemeSnapshot> {
    const reservationInput = {
      electricityRateIdrPerKwh: existing.electricityRateIdrPerKwh,
      waterRateIdrPerM3: existing.waterRateIdrPerM3,
      maintenanceFeeIdrPerMonth: existing.maintenanceFeeIdrPerMonth,
      electricityMinKwh: Number(existing.electricityMinKwh ?? 0),
      adminFeeIdrPerMonth: existing.adminFeeIdrPerMonth ?? 0,
      utilityAddons: asUtilityAddons(existing.utilityAddons),
    };
    if (reservationInput.utilityAddons.length > 0) {
      return resolveUtilitySchemeSnapshot(reservationInput);
    }

    const unitType = await this.prisma.unitType.findUnique({
      where: { id: existing.unitTypeId },
      select: {
        electricityRateIdrPerKwh: true,
        waterRateIdrPerM3: true,
        maintenanceFeeIdrPerMonth: true,
        electricityMinKwh: true,
        adminFeeIdrPerMonth: true,
        utilityAddons: {
          orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
          select: {
            utility: true,
            name: true,
            kind: true,
            value: true,
            sortOrder: true,
          },
        },
      },
    });
    if (!unitType) {
      return resolveUtilitySchemeSnapshot(reservationInput);
    }

    return resolveUtilitySchemeSnapshot(reservationInput, {
      electricityRateIdrPerKwh: unitType.electricityRateIdrPerKwh,
      waterRateIdrPerM3: unitType.waterRateIdrPerM3,
      maintenanceFeeIdrPerMonth: unitType.maintenanceFeeIdrPerMonth,
      electricityMinKwh: Number(unitType.electricityMinKwh ?? 0),
      adminFeeIdrPerMonth: unitType.adminFeeIdrPerMonth ?? 0,
      utilityAddons: asUtilityAddons(unitType.utilityAddons),
    });
  }

  private async loadBookableUnit(input: {
    propertyId: string;
    unitId: string;
    unitTypeId: string;
  }) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: input.unitId },
      include: {
        property: { select: { id: true, isActive: true } },
        unitType: {
          select: {
            id: true,
            propertyId: true,
            isActive: true,
            maxGuests: true,
            electricityRateIdrPerKwh: true,
            waterRateIdrPerM3: true,
            maintenanceFeeIdrPerMonth: true,
            electricityMinKwh: true,
            adminFeeIdrPerMonth: true,
            utilityAddons: {
              orderBy: [
                { sortOrder: 'asc' as const },
                { name: 'asc' as const },
              ],
              select: {
                utility: true,
                name: true,
                kind: true,
                value: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });
    if (!unit || unit.propertyId !== input.propertyId) {
      throw new BadRequestException({
        message: 'Unit not found on this property',
        details: {
          field: 'unitId',
          reason: ApiFieldReason.UNIT_NOT_BOOKABLE,
        },
      });
    }
    if (unit.unitTypeId !== input.unitTypeId) {
      throw new BadRequestException({
        message: 'Unit type does not match unit',
        details: {
          field: 'unitTypeId',
          reason: ApiFieldReason.UNIT_TYPE_INVALID,
        },
      });
    }
    if (
      !unit.property.isActive ||
      !unit.unitType.isActive ||
      !isUnitStatusBookable(unit.status)
    ) {
      throw new BadRequestException({
        message: 'Unit is not bookable',
        details: {
          field: 'unitId',
          reason: ApiFieldReason.UNIT_NOT_BOOKABLE,
        },
      });
    }
    return unit;
  }

  /**
   * After a successful occupancy PATCH, clear warnings the desk already resolved:
   * - IMPORT_OVERLAP: nights/unit are free (overlap already asserted) → clear + drop hold
   * - DATES_DIFFER: local dates now match OTA feed → clear (else keep until Accept/Dismiss/sync)
   * - MISSING_FROM_FEED / OTA_STILL_LISTED: not resolved by date edit
   */
  private async resolveIcalWarningClearOnUpdate(input: {
    existing: {
      propertyId: string;
      source: StaffReservation['source'];
      externalRef: string | null;
      icalSyncWarning: string | null;
    };
    unitId: string;
    checkInDate: string;
    checkOutDate: string;
    occupancyTouched: boolean;
    datesTouched: boolean;
  }): Promise<{ clearWarning: boolean; clearOverlapHold: boolean }> {
    const warning = input.existing.icalSyncWarning;
    if (!warning || !input.occupancyTouched) {
      return { clearWarning: false, clearOverlapHold: false };
    }

    if (warning === IcalSyncWarning.IMPORT_OVERLAP) {
      return { clearWarning: true, clearOverlapHold: true };
    }

    if (
      warning === IcalSyncWarning.DATES_DIFFER &&
      input.datesTouched &&
      input.existing.externalRef
    ) {
      const ota = await this.icalImportService.fetchEventDatesForUid({
        unitId: input.unitId,
        propertyId: input.existing.propertyId,
        source: input.existing.source,
        externalRef: input.existing.externalRef,
      });
      if (
        ota.kind === 'found' &&
        ota.checkInDate === input.checkInDate &&
        ota.checkOutDate === input.checkOutDate
      ) {
        return { clearWarning: true, clearOverlapHold: false };
      }
    }

    return { clearWarning: false, clearOverlapHold: false };
  }

  private async assertNoOverlap(input: {
    unitId: string;
    checkInDate: string;
    checkOutDate: string;
    busyEndDate?: string;
    excludeReservationId?: string;
  }): Promise<void> {
    const hit = await findOccupyingOverlap(this.prisma, input);
    if (hit) {
      this.throwOverlap(hit);
    }
  }

  private throwOverlap(hit: OverlapHit): never {
    if (hit.type === 'block') {
      throw new ConflictException({
        message: `These dates overlap a ${hit.kind.toLowerCase()} block (${this.ymd(hit.startDate)} → ${this.ymd(hit.endDate)})`,
        details: {
          field: 'checkInDate',
          reason: ApiFieldReason.OVERLAP_CONFLICT,
          conflictingBlock: {
            id: hit.id,
            kind: hit.kind,
            startDate: this.ymd(hit.startDate),
            endDate: this.ymd(hit.endDate),
          },
        },
      });
    }
    throw new ConflictException({
      message: `These dates overlap a stay by ${hit.guestName}`,
      details: {
        field: 'checkInDate',
        reason: ApiFieldReason.OVERLAP_CONFLICT,
        conflictingReservation: {
          id: hit.id,
          guestName: hit.guestName,
          source: hit.source,
          checkInDate: this.ymd(hit.checkInDate),
          checkOutDate: this.ymd(hit.checkOutDate),
          status: hit.status,
        },
      },
    });
  }

  private rethrowExclusionConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // unique externalRef — not overlap
      return;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2004' ||
        error.message.includes('Reservation_unit_occupying_excl'))
    ) {
      throw new ConflictException({
        message: 'These dates overlap an existing stay on this unit',
        details: {
          field: 'checkInDate',
          reason: ApiFieldReason.OVERLAP_CONFLICT,
        },
      });
    }
    // Postgres exclusion often surfaces as raw driver error
    if (
      error instanceof Error &&
      /Reservation_unit_occupying_excl|exclusion|23P01/i.test(error.message)
    ) {
      throw new ConflictException({
        message: 'These dates overlap an existing stay on this unit',
        details: {
          field: 'checkInDate',
          reason: ApiFieldReason.OVERLAP_CONFLICT,
        },
      });
    }
  }

  private assertDateRange(checkInDate: string, checkOutDate: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate)) {
      throw new BadRequestException({
        message: 'Invalid check-in date',
        details: {
          field: 'checkInDate',
          reason: ApiFieldReason.DATE_RANGE_INVALID,
        },
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
      throw new BadRequestException({
        message: 'Invalid check-out date',
        details: {
          field: 'checkOutDate',
          reason: ApiFieldReason.DATE_RANGE_INVALID,
        },
      });
    }
    if (checkOutDate <= checkInDate) {
      throw new BadRequestException({
        message: 'Check-out must be after check-in',
        details: {
          field: 'checkOutDate',
          reason: ApiFieldReason.DATE_RANGE_INVALID,
        },
      });
    }
  }

  private assertStayPeriodRange(
    billingPeriod: StayBillingPeriodType,
    checkInDate: string,
    checkOutDate: string,
  ): void {
    if (isValidStayPeriodRange(billingPeriod, checkInDate, checkOutDate)) {
      return;
    }
    const label =
      billingPeriod === StayBillingPeriod.MONTHLY
        ? 'monthly'
        : billingPeriod === StayBillingPeriod.YEARLY
          ? 'yearly'
          : 'daily';
    throw new BadRequestException({
      message: `Check-out does not match a valid ${label} stay from check-in`,
      details: {
        field: 'checkOutDate',
        reason: ApiFieldReason.STAY_PERIOD_MISMATCH,
      },
    });
  }

  private ymd(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private throwGuestCountExceedsMax(maxGuests: number): never {
    throw new BadRequestException({
      message: `Guest count exceeds this unit type's max (${maxGuests})`,
      details: {
        field: 'guestCount',
        reason: ApiFieldReason.GUEST_COUNT_EXCEEDS_MAX,
      },
    });
  }

  /**
   * Balance-due board: Due > 0, or Refund after CHECKED_OUT (doc §3.1).
   * Live excess is credit — not a chase. Money predicates stay in the DB.
   */
  private async balanceDueMoneyFilter(
    base: Prisma.ReservationWhereInput,
    query: ListReservationsQueryDto,
  ): Promise<Prisma.ReservationWhereInput> {
    const overpaidIds = await findOverpaidReservationIds(this.prisma, {
      propertyId: query.propertyId,
      source: query.source,
      status: query.status,
      checkInDate: query.checkInDate,
      checkOutDate: query.checkOutDate,
      from: query.from,
      to: query.to,
      billingPeriod: query.billingPeriod,
      hasIcalWarning: query.hasIcalWarning,
      q: query.q,
    });
    return withOpenBalanceMoney(base, overpaidIds);
  }

  private async resolveBoardToday(
    propertyId: string | undefined,
  ): Promise<string> {
    if (propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { timezone: true },
      });
      if (property?.timezone) {
        return todayYmdInTimezone(property.timezone);
      }
    }
    return todayYmdInTimezone(DEFAULT_BOARD_TIMEZONE);
  }

  private async buildListWhere(
    query: ListReservationsQueryDto,
  ): Promise<Prisma.ReservationWhereInput> {
    this.assertStayTouchQuery(query.from, query.to);

    const where: Prisma.ReservationWhereInput = {};
    if (query.propertyId) {
      where.propertyId = query.propertyId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.source) {
      where.source = query.source;
    }
    if (query.billingPeriod) {
      where.billingPeriod = query.billingPeriod;
    }
    if (query.checkInDate) {
      where.checkInDate = parseYmd(query.checkInDate);
    }
    if (query.checkOutDate) {
      where.checkOutDate = parseYmd(query.checkOutDate);
    }
    if (query.hasIcalWarning) {
      where.icalSyncWarning = { not: null };
    }
    if (query.occupyingOnly) {
      where.status = { in: [...OCCUPYING_RESERVATION_STATUSES] };
    }

    let balanceDue = false;
    if (query.board && query.board !== ReservationBoard.all) {
      switch (query.board) {
        case ReservationBoard.arrivals: {
          const today = await this.resolveBoardToday(query.propertyId);
          Object.assign(where, arrivalsWindow(parseYmd(today)));
          break;
        }
        case ReservationBoard['in-house']:
          where.status = ReservationStatus.CHECKED_IN;
          break;
        case ReservationBoard.departures: {
          const today = await this.resolveBoardToday(query.propertyId);
          Object.assign(where, departuresWindow(parseYmd(today)));
          break;
        }
        case ReservationBoard['needs-details']:
          where.status = ReservationStatus.UNCONFIRMED;
          break;
        case ReservationBoard['ical-alerts']:
          where.icalSyncWarning = { not: null };
          break;
        case ReservationBoard['balance-due']:
          where.status = {
            in: [
              ReservationStatus.UNCONFIRMED,
              ReservationStatus.CONFIRMED,
              ReservationStatus.CHECKED_IN,
              ReservationStatus.CHECKED_OUT,
            ],
          };
          balanceDue = true;
          break;
        case ReservationBoard['utilities-due']:
          // Computed notice — resolved in `list` via `findUtilitiesDueReservationIds`
          // ($queryRaw), not expressible as Prisma `where`.
          break;
        default:
          break;
      }
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { guestName: { contains: q, mode: 'insensitive' } },
        { guestEmail: { contains: q, mode: 'insensitive' } },
        { guestPhone: { contains: q, mode: 'insensitive' } },
        { externalRef: { contains: q, mode: 'insensitive' } },
        { unit: { code: { contains: q, mode: 'insensitive' } } },
        { property: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const withStayTouch = this.applyStayTouchRange(where, query.from, query.to);

    if (balanceDue) {
      return this.balanceDueMoneyFilter(withStayTouch, query);
    }

    return withStayTouch;
  }

  /**
   * Inclusive stay-touch overlap with `[from, to]` (missing `to` = open end).
   * Applied as AND so board date windows are not overwritten.
   */
  private applyStayTouchRange(
    where: Prisma.ReservationWhereInput,
    from: string | undefined,
    to: string | undefined,
  ): Prisma.ReservationWhereInput {
    if (!from) {
      return where;
    }
    const stayTouch: Prisma.ReservationWhereInput = to
      ? {
          AND: [
            { checkInDate: { lte: parseYmd(to) } },
            { checkOutDate: { gte: parseYmd(from) } },
          ],
        }
      : { checkOutDate: { gte: parseYmd(from) } };
    return { AND: [where, stayTouch] };
  }

  private assertStayTouchQuery(
    from: string | undefined,
    to: string | undefined,
  ): void {
    if (!from && !to) {
      return;
    }
    if (!from) {
      throw new BadRequestException(
        'from is required when to is set for the stay date filter',
      );
    }
    if (to && from > to) {
      throw new BadRequestException('from must be on or before to');
    }
  }
}
