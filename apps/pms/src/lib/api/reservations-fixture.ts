/**
 * In-memory reservation store for PMS Depth B/C (swap to Nest later).
 * Seed covers every board: arrivals, in-house, departures, needs details,
 * iCal alerts, balance due, and terminal rows.
 *
 * Cash: append-only PaymentMovement rows; paidAmountIdr = sum(signedAmount).
 */
import {
  buildPageInfo,
  CollectedVia,
  IcalSyncWarning,
  PaymentMovementDirection,
  PaymentMovementKind,
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  balanceDueIdr as computeBalanceDue,
  getConfirmFieldGaps,
  recomputePaymentStatus,
  refundDueIdr,
  signedAmountFor,
  sumPaidFromMovements,
  type Paginated,
  type PaymentMovement,
  type PaymentMovementDirection as PaymentMovementDirectionType,
  type PaymentMovementKind as PaymentMovementKindType,
  type StaffReservation,
} from "@cabin/api-contract";
import { PAGE_SIZE_DEFAULT } from "@cabin/api-contract";

/** Synthetic properties/units for fixture rows (create form uses live inventory via Choose). */
export const FIXTURE_PROPERTY_ID = "prop_skybreeze";
export const FIXTURE_PROPERTY_NAME = "Skybreeze Residences";
export const FIXTURE_PROPERTY_B_ID = "prop_harbor";
export const FIXTURE_PROPERTY_B_NAME = "Harbor View Cabins";
export const FIXTURE_UNIT_TYPE_ID = "ut_studio";
export const FIXTURE_UNIT_TYPE_B_ID = "ut_cabin";

/** Seed desk actor for manual fixture rows (iCal stubs leave attribution null). */
export const FIXTURE_DESK_ADMIN = {
  id: "adm_fixture_desk",
  username: "front.desk",
} as const;

/** Session admin stamped on create / update / cash lines. */
export type FixtureActor = {
  id: string;
  username: string;
} | null;

function actorCreateFields(actor: FixtureActor) {
  return {
    createdByAdminId: actor?.id ?? null,
    createdByAdminUsername: actor?.username ?? null,
    updatedByAdminId: actor?.id ?? null,
    updatedByAdminUsername: actor?.username ?? null,
  };
}

function actorUpdateFields(actor: FixtureActor) {
  return {
    updatedByAdminId: actor?.id ?? null,
    updatedByAdminUsername: actor?.username ?? null,
  };
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newMovementId(): string {
  return `pm_${Math.random().toString(36).slice(2, 10)}`;
}

function withMoney(
  row: Omit<StaffReservation, "paymentStatus"> & {
    paymentStatus?: StaffReservation["paymentStatus"];
  },
): StaffReservation {
  const paymentStatus =
    row.paymentStatus ??
    recomputePaymentStatus({
      totalAmountIdr: row.totalAmountIdr,
      paidAmountIdr: row.paidAmountIdr,
    });
  return { ...row, paymentStatus };
}

function makeMovement(input: {
  reservationId: string;
  direction: PaymentMovementDirectionType;
  kind: PaymentMovementKindType;
  amountIdr: number;
  method: StaffReservation["collectedVia"];
  note?: string | null;
  createdAt?: string;
  actor?: FixtureActor;
}): PaymentMovement {
  const amountIdr = Math.floor(input.amountIdr);
  if (!Number.isFinite(amountIdr) || amountIdr <= 0) {
    throw new Error("Movement amount must be > 0");
  }
  const actor = input.actor ?? null;
  return {
    id: newMovementId(),
    reservationId: input.reservationId,
    direction: input.direction,
    kind: input.kind,
    amountIdr,
    signedAmount: signedAmountFor(input.direction, amountIdr),
    method: input.method,
    note: input.note?.trim() || null,
    createdAt: input.createdAt ?? nowIso(),
    createdByAdminId: actor?.id ?? null,
    createdByAdminUsername: actor?.username ?? null,
  };
}

function movementsFor(reservationId: string): PaymentMovement[] {
  return movementStore.get(reservationId) ?? [];
}

function setMovements(
  reservationId: string,
  movements: PaymentMovement[],
): void {
  if (movements.length === 0) {
    movementStore.delete(reservationId);
    return;
  }
  movementStore.set(reservationId, movements);
}

function withoutMovementsField(row: StaffReservation): StaffReservation {
  if (row.movements === undefined) {
    return row;
  }
  const { movements, ...rest } = row;
  void movements;
  return rest;
}

function withSyncedPaid(
  row: StaffReservation,
  opts?: { forceRefunded?: boolean },
): StaffReservation {
  const movements = movementsFor(row.id);
  const paidAmountIdr = sumPaidFromMovements(movements);
  const lastMethod =
    [...movements].reverse().find((m) => m.method != null)?.method ??
    row.collectedVia;
  return withMoney({
    ...withoutMovementsField(row),
    paidAmountIdr,
    collectedVia: lastMethod,
    paymentStatus: recomputePaymentStatus({
      totalAmountIdr: row.totalAmountIdr,
      paidAmountIdr,
      forceRefunded: opts?.forceRefunded === true,
    }),
  });
}

function attachMovements(row: StaffReservation): StaffReservation {
  return {
    ...row,
    movements: [...movementsFor(row.id)],
  };
}

/** Seed one (or IN+OUT for REFUNDED) synthetic movement so Paid matches seed. */
function seedMovementsForRow(
  row: StaffReservation,
  ts: string,
  actor: FixtureActor,
): void {
  if (row.paymentStatus === PaymentStatus.REFUNDED && row.paidAmountIdr === 0) {
    const refundedAmount = Math.max(1, row.totalAmountIdr ?? 1);
    setMovements(row.id, [
      makeMovement({
        reservationId: row.id,
        direction: PaymentMovementDirection.IN,
        kind:
          row.collectedVia === CollectedVia.CHANNEL
            ? PaymentMovementKind.CHANNEL_SETTLED
            : PaymentMovementKind.DEPOSIT,
        amountIdr: refundedAmount,
        method: row.collectedVia,
        note: "Seed: prior collection",
        createdAt: ts,
        actor,
      }),
      makeMovement({
        reservationId: row.id,
        direction: PaymentMovementDirection.OUT,
        kind: PaymentMovementKind.CANCEL_REFUND,
        amountIdr: refundedAmount,
        method: row.collectedVia,
        note: "Seed: full refund",
        createdAt: ts,
        actor,
      }),
    ]);
    return;
  }

  if (row.paidAmountIdr <= 0) {
    setMovements(row.id, []);
    return;
  }

  const kind =
    row.collectedVia === CollectedVia.CHANNEL &&
    row.paidAmountIdr === (row.totalAmountIdr ?? -1)
      ? PaymentMovementKind.CHANNEL_SETTLED
      : row.paidAmountIdr < (row.totalAmountIdr ?? Number.POSITIVE_INFINITY)
        ? PaymentMovementKind.DEPOSIT
        : PaymentMovementKind.TOP_UP;

  setMovements(row.id, [
    makeMovement({
      reservationId: row.id,
      direction: PaymentMovementDirection.IN,
      kind:
        kind === PaymentMovementKind.TOP_UP &&
        row.paidAmountIdr === row.totalAmountIdr
          ? PaymentMovementKind.DEPOSIT
          : kind === PaymentMovementKind.CHANNEL_SETTLED
            ? PaymentMovementKind.CHANNEL_SETTLED
            : PaymentMovementKind.DEPOSIT,
      amountIdr: row.paidAmountIdr,
      method: row.collectedVia,
      note: "Seed: opening balance",
      createdAt: ts,
      actor,
    }),
  ]);
}

function rebuildMovementStore(rows: StaffReservation[], ts: string): void {
  movementStore.clear();
  for (const row of rows) {
    const actor =
      row.source === ReservationSource.MANUAL ||
      row.source === ReservationSource.WEBSITE
        ? FIXTURE_DESK_ADMIN
        : null;
    seedMovementsForRow(row, ts, actor);
  }
}

type SeedPartial = {
  id: string;
  propertyId?: string;
  propertyName?: string;
  unitId: string;
  unitCode: string;
  unitTypeId?: string;
  source: StaffReservation["source"];
  status: StaffReservation["status"];
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestCount?: number | null;
  notes?: string | null;
  totalAmountIdr: number | null;
  paidAmountIdr: number;
  collectedVia?: StaffReservation["collectedVia"];
  externalRef?: string | null;
  icalSyncWarning?: StaffReservation["icalSyncWarning"];
  paymentStatus?: StaffReservation["paymentStatus"];
};

function seedRow(partial: SeedPartial, ts: string): StaffReservation {
  const propertyId = partial.propertyId ?? FIXTURE_PROPERTY_ID;
  const propertyName =
    partial.propertyName ??
    (propertyId === FIXTURE_PROPERTY_B_ID
      ? FIXTURE_PROPERTY_B_NAME
      : FIXTURE_PROPERTY_NAME);
  const status = partial.status;
  return withMoney({
    id: partial.id,
    propertyId,
    propertyName,
    unitId: partial.unitId,
    unitCode: partial.unitCode,
    unitTypeId:
      partial.unitTypeId ??
      (propertyId === FIXTURE_PROPERTY_B_ID
        ? FIXTURE_UNIT_TYPE_B_ID
        : FIXTURE_UNIT_TYPE_ID),
    source: partial.source,
    status,
    checkInDate: partial.checkInDate,
    checkOutDate: partial.checkOutDate,
    guestName: partial.guestName,
    guestEmail: partial.guestEmail ?? null,
    guestPhone: partial.guestPhone ?? null,
    guestCount: partial.guestCount ?? null,
    notes: partial.notes ?? null,
    totalAmountIdr: partial.totalAmountIdr,
    paidAmountIdr: partial.paidAmountIdr,
    collectedVia: partial.collectedVia ?? null,
    externalRef: partial.externalRef ?? null,
    icalSyncWarning: partial.icalSyncWarning ?? null,
    icalSyncWarnedAt: partial.icalSyncWarning ? ts : null,
    confirmedAt: status === ReservationStatus.UNCONFIRMED ? null : ts,
    checkedInAt:
      status === ReservationStatus.CHECKED_IN ||
      status === ReservationStatus.CHECKED_OUT
        ? ts
        : null,
    checkedOutAt:
      status === ReservationStatus.CHECKED_OUT ? ts : null,
    cancelledAt: status === ReservationStatus.CANCELLED ? ts : null,
    noShowAt: status === ReservationStatus.NO_SHOW ? ts : null,
    createdAt: ts,
    updatedAt: ts,
    ...actorCreateFields(
      partial.source === ReservationSource.MANUAL ||
        partial.source === ReservationSource.WEBSITE
        ? FIXTURE_DESK_ADMIN
        : null,
    ),
    ...(partial.paymentStatus
      ? { paymentStatus: partial.paymentStatus }
      : {}),
  });
}

function buildSeed(): StaffReservation[] {
  const today = todayYmd();
  const ts = nowIso();

  return [
    seedRow(
      {
        id: "res_arrival_dp",
        unitId: "unit_1208",
        unitCode: "1208",
        source: ReservationSource.MANUAL,
        status: ReservationStatus.CONFIRMED,
        checkInDate: today,
        checkOutDate: addDaysYmd(today, 2),
        guestName: "Ayu Pratiwi",
        guestEmail: "ayu@example.com",
        guestPhone: "+628111000111",
        guestCount: 2,
        totalAmountIdr: 1_200_000,
        paidAmountIdr: 400_000,
        collectedVia: CollectedVia.PROPERTY,
      },
      ts,
    ),
    seedRow(
      {
        id: "res_arrival_paid",
        unitId: "unit_1209",
        unitCode: "1209",
        source: ReservationSource.BOOKING_COM,
        status: ReservationStatus.CONFIRMED,
        checkInDate: today,
        checkOutDate: addDaysYmd(today, 3),
        guestName: "Hiro Tanaka",
        guestEmail: "hiro@example.com",
        guestPhone: null,
        guestCount: 1,
        totalAmountIdr: 2_750_000,
        paidAmountIdr: 2_750_000,
        collectedVia: CollectedVia.CHANNEL,
        externalRef: "BKG-11002",
        notes: "Paid on Booking — Due should be 0",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_arrival_unpaid",
        unitId: "unit_a01",
        unitCode: "A01",
        propertyId: FIXTURE_PROPERTY_B_ID,
        source: ReservationSource.AIRBNB,
        status: ReservationStatus.CONFIRMED,
        checkInDate: today,
        checkOutDate: addDaysYmd(today, 1),
        guestName: "Emma Rossi",
        guestPhone: "+628177778888",
        guestCount: 2,
        totalAmountIdr: 1_950_000,
        paidAmountIdr: 0,
        externalRef: "ABB-same-day",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_inhouse_paid",
        unitId: "unit_1210",
        unitCode: "1210",
        source: ReservationSource.BOOKING_COM,
        status: ReservationStatus.CHECKED_IN,
        checkInDate: addDaysYmd(today, -1),
        checkOutDate: addDaysYmd(today, 2),
        guestName: "James Chen",
        guestEmail: "james@example.com",
        guestCount: 1,
        notes: "Late checkout requested",
        totalAmountIdr: 1_800_000,
        paidAmountIdr: 1_800_000,
        collectedVia: CollectedVia.CHANNEL,
        externalRef: "BKG-99821",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_inhouse_due",
        unitId: "unit_1305",
        unitCode: "1305",
        source: ReservationSource.MANUAL,
        status: ReservationStatus.CHECKED_IN,
        checkInDate: addDaysYmd(today, -2),
        checkOutDate: addDaysYmd(today, 1),
        guestName: "Dewi Lestari",
        guestPhone: "+628199990000",
        guestCount: 4,
        notes: "Extended one night — top-up pending",
        totalAmountIdr: 3_600_000,
        paidAmountIdr: 2_000_000,
        collectedVia: CollectedVia.MIXED,
      },
      ts,
    ),
    seedRow(
      {
        id: "res_inhouse_long_idr",
        unitId: "unit_b12",
        unitCode: "B12",
        propertyId: FIXTURE_PROPERTY_B_ID,
        source: ReservationSource.WEBSITE,
        status: ReservationStatus.CHECKED_IN,
        checkInDate: addDaysYmd(today, -4),
        checkOutDate: addDaysYmd(today, 3),
        guestName: "Priya Nair",
        guestEmail: "priya@example.com",
        guestPhone: "+628122334455",
        guestCount: 3,
        totalAmountIdr: 12_450_000,
        paidAmountIdr: 12_450_000,
        collectedVia: CollectedVia.PROPERTY,
      },
      ts,
    ),
    seedRow(
      {
        id: "res_depart_airbnb",
        unitId: "unit_1211",
        unitCode: "1211",
        source: ReservationSource.AIRBNB,
        status: ReservationStatus.CHECKED_IN,
        checkInDate: addDaysYmd(today, -3),
        checkOutDate: today,
        guestName: "Sara Wijaya",
        guestPhone: "+628122223333",
        guestCount: 2,
        totalAmountIdr: 2_100_000,
        paidAmountIdr: 2_100_000,
        collectedVia: CollectedVia.CHANNEL,
        externalRef: "ABB-4410",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_depart_due",
        unitId: "unit_1212",
        unitCode: "1212",
        source: ReservationSource.MANUAL,
        status: ReservationStatus.CHECKED_IN,
        checkInDate: addDaysYmd(today, -2),
        checkOutDate: today,
        guestName: "Andi Nugroho",
        guestPhone: "+628133221100",
        guestEmail: "andi@example.com",
        guestCount: 2,
        notes: "Collect remaining before checkout",
        totalAmountIdr: 1_650_000,
        paidAmountIdr: 500_000,
        collectedVia: CollectedVia.PROPERTY,
      },
      ts,
    ),
    seedRow(
      {
        id: "res_depart_agoda",
        unitId: "unit_c03",
        unitCode: "C03",
        propertyId: FIXTURE_PROPERTY_B_ID,
        source: ReservationSource.AGODA,
        status: ReservationStatus.CHECKED_IN,
        checkInDate: addDaysYmd(today, -1),
        checkOutDate: today,
        guestName: "Lucas Meyer",
        guestEmail: "lucas@example.com",
        guestCount: 1,
        totalAmountIdr: 980_000,
        paidAmountIdr: 980_000,
        collectedVia: CollectedVia.CHANNEL,
        externalRef: "AGD-departure",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_stub_agoda",
        unitId: "unit_1301",
        unitCode: "1301",
        source: ReservationSource.AGODA,
        status: ReservationStatus.UNCONFIRMED,
        checkInDate: addDaysYmd(today, 3),
        checkOutDate: addDaysYmd(today, 5),
        guestName: "Guest (iCal)",
        totalAmountIdr: null,
        paidAmountIdr: 0,
        externalRef: "agoda-uid-7788",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_stub_booking",
        unitId: "unit_1303",
        unitCode: "1303",
        source: ReservationSource.BOOKING_COM,
        status: ReservationStatus.UNCONFIRMED,
        checkInDate: addDaysYmd(today, 4),
        checkOutDate: addDaysYmd(today, 6),
        guestName: "Reserved (iCal)",
        totalAmountIdr: null,
        paidAmountIdr: 0,
        externalRef: "bkg-uid-5521",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_stub_airbnb",
        unitId: "unit_d07",
        unitCode: "D07",
        propertyId: FIXTURE_PROPERTY_B_ID,
        source: ReservationSource.AIRBNB,
        status: ReservationStatus.UNCONFIRMED,
        checkInDate: addDaysYmd(today, 8),
        checkOutDate: addDaysYmd(today, 10),
        guestName: "Airbnb guest (iCal)",
        totalAmountIdr: null,
        paidAmountIdr: 0,
        externalRef: "abb-uid-9901",
        notes: "SUMMARY looked like a name — still needs contact + total",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_ical_missing",
        unitId: "unit_1302",
        unitCode: "1302",
        source: ReservationSource.BOOKING_COM,
        status: ReservationStatus.CONFIRMED,
        checkInDate: addDaysYmd(today, 5),
        checkOutDate: addDaysYmd(today, 7),
        guestName: "Rina Kartika",
        guestEmail: "rina@example.com",
        guestPhone: "+628133334444",
        guestCount: 2,
        totalAmountIdr: 1_500_000,
        paidAmountIdr: 0,
        externalRef: "BKG-missing-feed",
        icalSyncWarning: IcalSyncWarning.MISSING_FROM_FEED,
      },
      ts,
    ),
    seedRow(
      {
        id: "res_ical_dates",
        unitId: "unit_1304",
        unitCode: "1304",
        source: ReservationSource.AIRBNB,
        status: ReservationStatus.CONFIRMED,
        checkInDate: addDaysYmd(today, 6),
        checkOutDate: addDaysYmd(today, 9),
        guestName: "Tom Hughes",
        guestEmail: "tom@example.com",
        guestCount: 2,
        totalAmountIdr: 2_200_000,
        paidAmountIdr: 2_200_000,
        collectedVia: CollectedVia.CHANNEL,
        externalRef: "ABB-dates-differ",
        icalSyncWarning: IcalSyncWarning.DATES_DIFFER,
        notes: "OTA feed shows different checkout — Accept or Keep",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_ical_missing_inhouse",
        unitId: "unit_1306",
        unitCode: "1306",
        source: ReservationSource.AGODA,
        status: ReservationStatus.CHECKED_IN,
        checkInDate: addDaysYmd(today, -1),
        checkOutDate: addDaysYmd(today, 2),
        guestName: "Siti Rahayu",
        guestPhone: "+628144556677",
        guestCount: 2,
        totalAmountIdr: 1_100_000,
        paidAmountIdr: 1_100_000,
        collectedVia: CollectedVia.CHANNEL,
        externalRef: "AGD-urgent-missing",
        icalSyncWarning: IcalSyncWarning.MISSING_FROM_FEED,
        notes: "Urgent — guest already in-house, UID gone from feed",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_due_walkin",
        unitId: "unit_1401",
        unitCode: "1401",
        source: ReservationSource.MANUAL,
        status: ReservationStatus.CONFIRMED,
        checkInDate: addDaysYmd(today, 1),
        checkOutDate: addDaysYmd(today, 4),
        guestName: "Budi Santoso",
        guestPhone: "+628155556666",
        guestCount: 3,
        notes: "Walk-in DP only",
        totalAmountIdr: 2_400_000,
        paidAmountIdr: 500_000,
        collectedVia: CollectedVia.PROPERTY,
      },
      ts,
    ),
    seedRow(
      {
        id: "res_due_whatsapp",
        unitId: "unit_1402",
        unitCode: "1402",
        source: ReservationSource.MANUAL,
        status: ReservationStatus.CONFIRMED,
        checkInDate: addDaysYmd(today, 2),
        checkOutDate: addDaysYmd(today, 5),
        guestName: "Farah Aziz",
        guestPhone: "+628166677788",
        guestEmail: "farah@example.com",
        guestCount: 2,
        notes: "Booked via WhatsApp",
        totalAmountIdr: 4_875_000,
        paidAmountIdr: 0,
      },
      ts,
    ),
    seedRow(
      {
        id: "res_due_harbor",
        unitId: "unit_e02",
        unitCode: "E02",
        propertyId: FIXTURE_PROPERTY_B_ID,
        source: ReservationSource.WEBSITE,
        status: ReservationStatus.CONFIRMED,
        checkInDate: addDaysYmd(today, 7),
        checkOutDate: addDaysYmd(today, 10),
        guestName: "Noah Kim",
        guestEmail: "noah@example.com",
        guestCount: 2,
        totalAmountIdr: 5_250_000,
        paidAmountIdr: 1_000_000,
        collectedVia: CollectedVia.PROPERTY,
      },
      ts,
    ),
    seedRow(
      {
        id: "res_checked_out",
        unitId: "unit_1501",
        unitCode: "1501",
        source: ReservationSource.WEBSITE,
        status: ReservationStatus.CHECKED_OUT,
        checkInDate: addDaysYmd(today, -5),
        checkOutDate: addDaysYmd(today, -2),
        guestName: "Maya Lim",
        guestEmail: "maya@example.com",
        guestCount: 2,
        totalAmountIdr: 900_000,
        paidAmountIdr: 900_000,
        collectedVia: CollectedVia.PROPERTY,
      },
      ts,
    ),
    seedRow(
      {
        id: "res_cancelled_refund",
        unitId: "unit_1502",
        unitCode: "1502",
        source: ReservationSource.BOOKING_COM,
        status: ReservationStatus.CANCELLED,
        checkInDate: addDaysYmd(today, 10),
        checkOutDate: addDaysYmd(today, 12),
        guestName: "Omar Hassan",
        guestEmail: "omar@example.com",
        guestCount: 1,
        totalAmountIdr: 1_400_000,
        paidAmountIdr: 0,
        paymentStatus: PaymentStatus.REFUNDED,
        collectedVia: CollectedVia.CHANNEL,
        externalRef: "BKG-cancelled",
        notes: "Guest cancelled — full refund recorded",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_no_show",
        unitId: "unit_1503",
        unitCode: "1503",
        source: ReservationSource.MANUAL,
        status: ReservationStatus.NO_SHOW,
        checkInDate: addDaysYmd(today, -1),
        checkOutDate: addDaysYmd(today, 1),
        guestName: "Kevin Hartono",
        guestPhone: "+628188899900",
        guestCount: 2,
        totalAmountIdr: 1_100_000,
        paidAmountIdr: 300_000,
        collectedVia: CollectedVia.PROPERTY,
        notes: "No-show — DP kept",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_complimentary",
        unitId: "unit_1601",
        unitCode: "1601",
        source: ReservationSource.MANUAL,
        status: ReservationStatus.CONFIRMED,
        checkInDate: addDaysYmd(today, 14),
        checkOutDate: addDaysYmd(today, 16),
        guestName: "Owner friend — complimentary",
        guestPhone: "+628100011122",
        guestCount: 2,
        totalAmountIdr: 0,
        paidAmountIdr: 0,
        notes: "total = 0 → treated as PAID / due 0",
      },
      ts,
    ),
    seedRow(
      {
        id: "res_mark_paid_edge",
        unitId: "unit_1602",
        unitCode: "1602",
        source: ReservationSource.MANUAL,
        status: ReservationStatus.CONFIRMED,
        checkInDate: addDaysYmd(today, 12),
        checkOutDate: addDaysYmd(today, 13),
        guestName: "Fully paid walk-in",
        guestEmail: "paid@example.com",
        guestCount: 1,
        totalAmountIdr: 750_000,
        paidAmountIdr: 750_000,
        collectedVia: CollectedVia.PROPERTY,
        notes: "paid = total → PAID, Due = 0",
      },
      ts,
    ),
  ];
}

let store: StaffReservation[] = buildSeed();
/** Append-only cash lines keyed by reservation id (oldest → newest). */
let movementStore: Map<string, PaymentMovement[]> = new Map();
rebuildMovementStore(store, nowIso());
// Re-sync paid from seeded movements (REFUNDED rows stay forceRefunded).
store = store.map((row) =>
  withSyncedPaid(row, {
    forceRefunded: row.paymentStatus === PaymentStatus.REFUNDED,
  }),
);

export function resetReservationsFixture(): void {
  store = buildSeed();
  rebuildMovementStore(store, nowIso());
  store = store.map((row) =>
    withSyncedPaid(row, {
      forceRefunded: row.paymentStatus === PaymentStatus.REFUNDED,
    }),
  );
}


export type FixtureListFilters = {
  propertyId?: string;
  q?: string;
  status?: StaffReservation["status"];
  source?: StaffReservation["source"];
  /** Board presets — applied in addition to explicit filters. */
  board?:
    | "arrivals"
    | "in-house"
    | "departures"
    | "needs-details"
    | "ical-alerts"
    | "balance-due"
    | "all";
  checkInDate?: string;
  checkOutDate?: string;
  hasIcalWarning?: boolean;
  paymentStatusIn?: StaffReservation["paymentStatus"][];
  occupyingOnly?: boolean;
};

function matchesBoard(
  row: StaffReservation,
  board: NonNullable<FixtureListFilters["board"]>,
  today: string,
): boolean {
  switch (board) {
    case "all":
      return true;
    case "arrivals":
      return (
        row.checkInDate === today &&
        row.status === ReservationStatus.CONFIRMED
      );
    case "in-house":
      return row.status === ReservationStatus.CHECKED_IN;
    case "departures":
      return (
        row.checkOutDate === today &&
        row.status === ReservationStatus.CHECKED_IN
      );
    case "needs-details":
      return row.status === ReservationStatus.UNCONFIRMED;
    case "ical-alerts":
      return row.icalSyncWarning != null;
    case "balance-due": {
      const due = computeBalanceDue(row.totalAmountIdr, row.paidAmountIdr);
      const refund = refundDueIdr(row.totalAmountIdr, row.paidAmountIdr);
      const moneyOpen =
        (due != null && due > 0) ||
        (refund != null && refund > 0) ||
        row.paymentStatus === PaymentStatus.UNPAID ||
        row.paymentStatus === PaymentStatus.DEPOSIT;
      return (
        (row.status === ReservationStatus.UNCONFIRMED ||
          row.status === ReservationStatus.CONFIRMED ||
          row.status === ReservationStatus.CHECKED_IN ||
          row.status === ReservationStatus.CHECKED_OUT) &&
        moneyOpen
      );
    }
  }
}

function filterRows(filters: FixtureListFilters): StaffReservation[] {
  const today = todayYmd();
  const q = filters.q?.trim().toLowerCase();

  return store.filter((row) => {
    if (filters.propertyId && row.propertyId !== filters.propertyId) {
      return false;
    }
    if (filters.status && row.status !== filters.status) {
      return false;
    }
    if (filters.source && row.source !== filters.source) {
      return false;
    }
    if (filters.checkInDate && row.checkInDate !== filters.checkInDate) {
      return false;
    }
    if (filters.checkOutDate && row.checkOutDate !== filters.checkOutDate) {
      return false;
    }
    if (filters.hasIcalWarning && row.icalSyncWarning == null) {
      return false;
    }
    if (
      filters.paymentStatusIn &&
      !filters.paymentStatusIn.includes(row.paymentStatus)
    ) {
      return false;
    }
    if (filters.occupyingOnly) {
      const occupying =
        row.status === ReservationStatus.UNCONFIRMED ||
        row.status === ReservationStatus.CONFIRMED ||
        row.status === ReservationStatus.CHECKED_IN;
      if (!occupying) {
        return false;
      }
    }
    if (filters.board && filters.board !== "all") {
      if (!matchesBoard(row, filters.board, today)) {
        return false;
      }
    }
    if (q) {
      const hay = [
        row.guestName,
        row.unitCode,
        row.guestEmail ?? "",
        row.guestPhone ?? "",
        row.externalRef ?? "",
        row.propertyName,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

export function fixtureListReservations(
  filters: FixtureListFilters = {},
  page = 1,
  pageSize = PAGE_SIZE_DEFAULT,
): Paginated<StaffReservation> {
  const filtered = filterRows(filters).sort((a, b) =>
    a.checkInDate < b.checkInDate ? -1 : a.checkInDate > b.checkInDate ? 1 : 0,
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  // List omits movements for lightness — Paid cache stays on the row.
  const items = filtered
    .slice(start, start + pageSize)
    .map((row) => withoutMovementsField(row));
  return { items, pageInfo: buildPageInfo(page, pageSize, total) };
}

export function fixtureGetReservation(id: string): StaffReservation | null {
  const row = store.find((r) => r.id === id);
  if (!row) {
    return null;
  }
  return attachMovements(row);
}

export type FixtureCreateInput = {
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitCode: string;
  unitTypeId: string;
  source: StaffReservation["source"];
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestCount: number;
  notes?: string | null;
  totalAmountIdr: number;
  /**
   * Opening money IN (first DEPOSIT movement when > 0).
   * Same shape as Collect amount — not a Paid-cache overwrite.
   */
  depositAmountIdr: number;
};

export function fixtureCreateReservation(
  input: FixtureCreateInput,
  actor: FixtureActor = null,
): StaffReservation {
  const ts = nowIso();
  const id = `res_${Math.random().toString(36).slice(2, 10)}`;
  const depositAmountIdr = Math.max(0, Math.floor(input.depositAmountIdr));
  if (!Number.isFinite(depositAmountIdr) || depositAmountIdr < 0) {
    throw new Error("Deposit cannot be negative");
  }
  if (input.totalAmountIdr < 0) {
    throw new Error("Total cannot be negative");
  }

  let row = withMoney({
    id,
    propertyId: input.propertyId,
    propertyName: input.propertyName,
    unitId: input.unitId,
    unitCode: input.unitCode,
    unitTypeId: input.unitTypeId,
    source: input.source,
    status: ReservationStatus.CONFIRMED,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    guestName: input.guestName,
    guestEmail: input.guestEmail ?? null,
    guestPhone: input.guestPhone ?? null,
    guestCount: input.guestCount,
    notes: input.notes ?? null,
    totalAmountIdr: input.totalAmountIdr,
    paidAmountIdr: 0,
    collectedVia: null,
    externalRef: null,
    icalSyncWarning: null,
    icalSyncWarnedAt: null,
    confirmedAt: ts,
    checkedInAt: null,
    checkedOutAt: null,
    cancelledAt: null,
    noShowAt: null,
    createdAt: ts,
    updatedAt: ts,
    ...actorCreateFields(actor),
  });

  store = [row, ...store];
  setMovements(id, []);

  if (depositAmountIdr > 0) {
    const movement = makeMovement({
      reservationId: id,
      direction: PaymentMovementDirection.IN,
      kind: PaymentMovementKind.DEPOSIT,
      amountIdr: depositAmountIdr,
      method: CollectedVia.PROPERTY,
      note: "Opening deposit on create",
      createdAt: ts,
      actor,
    });
    setMovements(id, [movement]);
  }

  row = withSyncedPaid(row);
  store = [row, ...store.slice(1)];
  return attachMovements(row);
}

export type FixtureUpdateInput = Partial<{
  unitId: string;
  unitCode: string;
  unitTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCount: number | null;
  notes: string | null;
  totalAmountIdr: number | null;
  source: StaffReservation["source"];
}>;

function patchRow(
  id: string,
  patch: (row: StaffReservation) => StaffReservation,
  opts?: { forceRefunded?: boolean; actor?: FixtureActor },
): StaffReservation {
  const idx = store.findIndex((r) => r.id === id);
  if (idx < 0) {
    throw new Error(`Reservation not found: ${id}`);
  }
  const actor = opts?.actor ?? null;
  const next = withSyncedPaid(
    {
      ...withoutMovementsField(patch(store[idx]!)),
      updatedAt: nowIso(),
      ...actorUpdateFields(actor),
    },
    opts,
  );
  store = [...store.slice(0, idx), next, ...store.slice(idx + 1)];
  return attachMovements(next);
}

export function fixtureUpdateReservation(
  id: string,
  input: FixtureUpdateInput,
  actor: FixtureActor = null,
): StaffReservation {
  return patchRow(
    id,
    (row) => ({
      ...row,
      ...input,
    }),
    { actor },
  );
}

export function fixtureConfirmReservation(
  id: string,
  actor: FixtureActor = null,
): StaffReservation {
  return patchRow(
    id,
    (row) => {
      if (row.status !== ReservationStatus.UNCONFIRMED) {
        throw new Error("Only UNCONFIRMED can be confirmed");
      }
      const gaps = getConfirmFieldGaps({
        unitId: row.unitId,
        checkInDate: row.checkInDate,
        checkOutDate: row.checkOutDate,
        guestName: row.guestName,
        guestEmail: row.guestEmail,
        guestPhone: row.guestPhone,
        guestCount: row.guestCount,
        totalAmountIdr: row.totalAmountIdr,
        paidAmountIdr: row.paidAmountIdr,
      });
      if (gaps.length > 0) {
        throw new Error(
          `Reservation is incomplete (${gaps.join(", ")}). Enrich guest and money first.`,
        );
      }
      return {
        ...row,
        status: ReservationStatus.CONFIRMED,
        guestName: row.guestName.trim(),
        confirmedAt: nowIso(),
      };
    },
    { actor },
  );
}

export function fixtureCheckInReservation(
  id: string,
  actor: FixtureActor = null,
): StaffReservation {
  return patchRow(
    id,
    (row) => {
      if (row.status !== ReservationStatus.CONFIRMED) {
        throw new Error("Only CONFIRMED can check in");
      }
      return {
        ...row,
        status: ReservationStatus.CHECKED_IN,
        checkedInAt: nowIso(),
      };
    },
    { actor },
  );
}

export function fixtureCheckOutReservation(
  id: string,
  actor: FixtureActor = null,
): StaffReservation {
  return patchRow(
    id,
    (row) => {
      if (row.status !== ReservationStatus.CHECKED_IN) {
        throw new Error("Only CHECKED_IN can check out");
      }
      return {
        ...row,
        status: ReservationStatus.CHECKED_OUT,
        checkedOutAt: nowIso(),
      };
    },
    { actor },
  );
}

export type FixturePostMovementInput = {
  direction: PaymentMovementDirectionType;
  kind: PaymentMovementKindType;
  amountIdr: number;
  method?: StaffReservation["collectedVia"];
  note?: string | null;
};

/**
 * Primary cash write — append movement, recompute Paid + paymentStatus.
 * Total quote changes belong on updateReservation / edit form, not here.
 */
export function fixturePostPaymentMovement(
  id: string,
  input: FixturePostMovementInput,
  actor: FixtureActor = null,
): StaffReservation {
  const idx = store.findIndex((r) => r.id === id);
  if (idx < 0) {
    throw new Error(`Reservation not found: ${id}`);
  }
  const row = store[idx]!;
  const amountIdr = Math.floor(input.amountIdr);
  if (!Number.isFinite(amountIdr) || amountIdr <= 0) {
    throw new Error("Amount must be > 0");
  }

  if (input.direction === PaymentMovementDirection.IN) {
    const due = computeBalanceDue(row.totalAmountIdr, row.paidAmountIdr);
    if (row.totalAmountIdr == null) {
      throw new Error("Set Total on the reservation before collecting");
    }
    if (due != null && amountIdr > due) {
      throw new Error(
        due <= 0
          ? "Nothing left to collect — Paid already covers Total"
          : `Collect cannot exceed Due (${due.toLocaleString("id-ID")})`,
      );
    }
  } else {
    const refund = refundDueIdr(row.totalAmountIdr, row.paidAmountIdr);
    const maxOut =
      refund != null && refund > 0
        ? refund
        : row.paidAmountIdr;
    if (amountIdr > maxOut) {
      throw new Error(
        `Refund cannot exceed ${maxOut.toLocaleString("id-ID")}`,
      );
    }
  }

  const movement = makeMovement({
    reservationId: id,
    direction: input.direction,
    kind: input.kind,
    amountIdr,
    method: input.method ?? null,
    note: input.note,
    actor,
  });
  setMovements(id, [...movementsFor(id), movement]);

  const next = withSyncedPaid({
    ...withoutMovementsField(row),
    updatedAt: nowIso(),
    ...actorUpdateFields(actor),
  });
  store = [...store.slice(0, idx), next, ...store.slice(idx + 1)];
  return attachMovements(next);
}

export type CancelDisposition = "none" | "full_refund" | "keep" | "partial";

export type FixtureCancelInput = {
  disposition?: CancelDisposition;
  /**
   * Amount returned to the guest (money OUT). Required when disposition is `partial`.
   * Must be > 0 and < current Paid (use `full_refund` to return everything).
   */
  refundAmountIdr?: number;
  notes?: string | null;
};

export function fixtureCancelReservation(
  id: string,
  input: FixtureCancelInput = {},
  actor: FixtureActor = null,
): StaffReservation {
  const idx = store.findIndex((r) => r.id === id);
  if (idx < 0) {
    throw new Error(`Reservation not found: ${id}`);
  }
  const row = store[idx]!;

  if (
    row.status === ReservationStatus.CHECKED_OUT ||
    row.status === ReservationStatus.CANCELLED ||
    row.status === ReservationStatus.NO_SHOW
  ) {
    throw new Error("Terminal reservation cannot be cancelled");
  }

  const disposition = input.disposition ?? "none";
  if (row.paidAmountIdr > 0 && disposition === "none") {
    throw new Error(
      "Choose a refund disposition: full_refund, keep, or partial",
    );
  }

  let forceRefunded = false;
  const existing = movementsFor(id);
  const nextMovements = [...existing];

  if (disposition === "full_refund" && row.paidAmountIdr > 0) {
    nextMovements.push(
      makeMovement({
        reservationId: id,
        direction: PaymentMovementDirection.OUT,
        kind: PaymentMovementKind.CANCEL_REFUND,
        amountIdr: row.paidAmountIdr,
        method: row.collectedVia,
        note: "Cancel: full refund",
        actor,
      }),
    );
    forceRefunded = true;
  } else if (disposition === "partial") {
    const refundAmountIdr = Math.floor(input.refundAmountIdr ?? Number.NaN);
    if (!Number.isFinite(refundAmountIdr)) {
      throw new Error("Partial refund requires refundAmountIdr");
    }
    if (refundAmountIdr <= 0) {
      throw new Error("refundAmountIdr must be > 0 (or use keep)");
    }
    if (refundAmountIdr >= row.paidAmountIdr) {
      throw new Error(
        "Partial refund must be less than Paid — use full_refund to return all",
      );
    }
    nextMovements.push(
      makeMovement({
        reservationId: id,
        direction: PaymentMovementDirection.OUT,
        kind: PaymentMovementKind.CANCEL_REFUND,
        amountIdr: refundAmountIdr,
        method: row.collectedVia,
        note: "Cancel: partial refund",
        actor,
      }),
    );
  } else if (disposition === "keep" || disposition === "none") {
    // Keep amounts / unpaid cancel — status only.
  }

  setMovements(id, nextMovements);

  const next = withSyncedPaid(
    {
      ...withoutMovementsField(row),
      notes:
        input.notes !== undefined
          ? input.notes?.trim() || null
          : row.notes,
      status: ReservationStatus.CANCELLED,
      cancelledAt: nowIso(),
      updatedAt: nowIso(),
      ...actorUpdateFields(actor),
    },
    { forceRefunded },
  );
  store = [...store.slice(0, idx), next, ...store.slice(idx + 1)];
  return attachMovements(next);
}

/** Display helper — also available from contract. */
export function fixtureBalanceDue(row: StaffReservation): number | null {
  return computeBalanceDue(row.totalAmountIdr, row.paidAmountIdr);
}
