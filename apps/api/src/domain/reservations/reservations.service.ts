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
  sumPaidFromMovements,
  todayYmdInTimezone,
  type Paginated,
  type StaffAdmin,
  type StaffReservation,
  type StaffReservationListItem,
} from '@cabin/api-contract';
import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../../prisma/prisma.service.js';
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
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListReservationsQueryDto,
  ): Promise<Paginated<StaffReservationListItem>> {
    const where = await this.buildListWhere(query);
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

    await this.assertNoOverlap({
      unitId: dto.unitId,
      checkInDate: dto.checkInDate,
      checkOutDate: dto.checkOutDate,
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
            checkInDate: parseYmd(dto.checkInDate),
            checkOutDate: parseYmd(dto.checkOutDate),
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

    const checkInDate = dto.checkInDate ?? this.ymd(existing.checkInDate);
    const checkOutDate = dto.checkOutDate ?? this.ymd(existing.checkOutDate);
    this.assertDateRange(checkInDate, checkOutDate);

    const unitId = dto.unitId ?? existing.unitId;
    const unitTypeId = dto.unitTypeId ?? existing.unitTypeId;

    let maxGuests: number | null = null;
    if (dto.unitId || dto.unitTypeId || dto.checkInDate || dto.checkOutDate) {
      const unit = await this.loadBookableUnit({
        propertyId: existing.propertyId,
        unitId,
        unitTypeId,
      });
      maxGuests = unit.unitType.maxGuests;
      await this.assertNoOverlap({
        unitId,
        checkInDate,
        checkOutDate,
        excludeReservationId: id,
      });
    } else if (dto.guestCount !== undefined) {
      const unitType = await this.prisma.unitType.findUnique({
        where: { id: unitTypeId },
        select: { maxGuests: true },
      });
      maxGuests = unitType?.maxGuests ?? null;
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

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.unitId || dto.checkInDate || dto.checkOutDate) {
          const overlap = await findOccupyingOverlap(tx, {
            unitId,
            checkInDate,
            checkOutDate,
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
            ...(dto.checkInDate !== undefined
              ? { checkInDate: parseYmd(dto.checkInDate) }
              : {}),
            ...(dto.checkOutDate !== undefined
              ? { checkOutDate: parseYmd(dto.checkOutDate) }
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

    await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CONFIRMED,
        guestName: row.guestName.trim(),
        confirmedAt: new Date(),
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

  private async assertNoOverlap(input: {
    unitId: string;
    checkInDate: string;
    checkOutDate: string;
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

    if (balanceDue) {
      return this.balanceDueMoneyFilter(where, query);
    }

    return where;
  }
}
