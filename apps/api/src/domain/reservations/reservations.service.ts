import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiFieldReason,
  balanceDueIdr,
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
  type Paginated,
  type StaffAdmin,
  type StaffReservation,
  type StaffReservationListItem,
  type StayBillingPeriod as StayBillingPeriodType,
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { IcalImportService } from '../ical/ical-import.service.js';
import type { CancelReservationDto } from './dto/cancel-reservation.dto.js';
import type { ConfirmEarlyDto } from './dto/confirm-early.dto.js';
import type { CreateReservationDto } from './dto/create-reservation.dto.js';
import type { ListReservationsQueryDto } from './dto/list-reservations.query.dto.js';
import type { PostPaymentMovementDto } from './dto/post-payment-movement.dto.js';
import type { UpdateReservationDto } from './dto/update-reservation.dto.js';
import { findOccupyingOverlap, type OverlapHit } from './overlap.js';
import {
  arrivalsWindow,
  departuresWindow,
  findOverpaidReservationIds,
  reservationListSelect,
  withOpenBalanceMoney,
} from './reservation-board-where.js';
import {
  parseYmd,
  toStaffReservation,
  toStaffReservationListItem,
} from './reservations-mapper.js';

/** Fallback when boards list all properties (doc prefers property-scoped boards). */
const DEFAULT_BOARD_TIMEZONE = 'Asia/Jakarta';

const reservationInclude = {
  property: { select: { name: true, timezone: true } },
  unit: { select: { code: true } },
  icalObservedUnit: { select: { code: true } },
  createdByAdmin: { select: { username: true } },
  updatedByAdmin: { select: { username: true } },
} as const;

const reservationDetailInclude = {
  ...reservationInclude,
  movements: {
    orderBy: { createdAt: 'asc' as const },
    include: { createdByAdmin: { select: { username: true } } },
  },
} as const;

type Actor = Pick<StaffAdmin, 'id'>;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly icalImportService: IcalImportService,
  ) {}

  async list(
    query: ListReservationsQueryDto,
  ): Promise<Paginated<StaffReservationListItem>> {
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

  async getById(id: string): Promise<StaffReservation> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: reservationDetailInclude,
    });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    return toStaffReservation(row, { includeMovements: true });
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
      totalAmountIdr: dto.totalAmountIdr,
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
    const totalAmountIdr = Math.floor(dto.totalAmountIdr);
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
            totalAmountIdr: BigInt(totalAmountIdr),
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
            ...(dto.totalAmountIdr !== undefined
              ? {
                  totalAmountIdr:
                    dto.totalAmountIdr == null
                      ? null
                      : BigInt(Math.floor(dto.totalAmountIdr)),
                }
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

        if (dto.totalAmountIdr !== undefined) {
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
      totalAmountIdr:
        row.totalAmountIdr == null ? null : Number(row.totalAmountIdr),
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
          computeInventoryEndYmd(
            row.billingPeriod,
            this.ymd(row.checkOutDate),
          ),
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
      const due = balanceDueIdr(total, paid);
      if (due != null && amountIdr > due) {
        throw new BadRequestException({
          message:
            due <= 0
              ? 'Nothing left to collect — Paid already covers Total'
              : `Collect cannot exceed Due (${due})`,
          details: {
            field: 'amountIdr',
            reason: ApiFieldReason.MOVEMENT_EXCEEDS_DUE,
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
      await tx.paymentMovement.create({
        data: {
          reservationId: id,
          direction: dto.direction,
          kind: dto.kind,
          amountIdr: BigInt(amountIdr),
          signedAmount: BigInt(signed),
          method: dto.method ?? null,
          note: dto.note?.trim() || null,
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
   * Balance-due board: Due > 0 or Refund > 0 (doc §3.1).
   * Money predicates stay in the DB — never page-then-filter in memory.
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
