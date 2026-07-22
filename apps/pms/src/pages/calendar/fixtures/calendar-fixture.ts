/**
 * In-memory property calendar fixture (FE-first).
 * Swap `getPropertyCalendar` / block CRUD to Nest when aggregate lands.
 */
import {
  CollectedVia,
  ApiError,
  ApiErrorCode,
  ApiFieldReason,
  CalendarBlockKind,
  IcalSyncWarning,
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  UnitStatus,
  type CreateStaffCalendarBlockInput,
  type StaffCalendarBlock,
  type StaffCalendarStay,
  type StaffCalendarUnit,
  type StaffPropertyCalendar,
  type UpdateStaffCalendarBlockInput,
} from "@cabin/api-contract";

/** Demo stay ids — not in Nest; detail navigation is blocked in UI. */
export const CALENDAR_DEMO_STAY_PREFIX = "cal_demo_";

export function isCalendarDemoStayId(id: string): boolean {
  return id.startsWith(CALENDAR_DEMO_STAY_PREFIX);
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function rangeOverlapsWindow(
  start: string,
  end: string,
  from: string,
  to: string,
): boolean {
  return overlaps(start, end, from, to);
}

type PropertyStore = {
  units: StaffCalendarUnit[];
  stays: StaffCalendarStay[];
  blocks: StaffCalendarBlock[];
  /** Stays from live create — merged into reads for this property. */
  liveStays: StaffCalendarStay[];
};

const stores = new Map<string, PropertyStore>();

function seedUnits(): StaffCalendarUnit[] {
  return [
    {
      id: "cal_unit_01",
      code: "C01",
      name: "Cabin 01",
      status: UnitStatus.ACTIVE,
      sortOrder: 10,
      unitType: { id: "cal_type_deluxe", name: "Deluxe", sortOrder: 10 },
    },
    {
      id: "cal_unit_02",
      code: "C02",
      name: "Cabin 02",
      status: UnitStatus.ACTIVE,
      sortOrder: 20,
      unitType: { id: "cal_type_deluxe", name: "Deluxe", sortOrder: 10 },
    },
    {
      id: "cal_unit_03",
      code: "C03",
      name: "Cabin 03",
      status: UnitStatus.ACTIVE,
      sortOrder: 10,
      unitType: { id: "cal_type_studio", name: "Studio", sortOrder: 20 },
    },
    {
      id: "cal_unit_04",
      code: "C04",
      name: "Cabin 04",
      status: UnitStatus.MAINTENANCE,
      sortOrder: 20,
      unitType: { id: "cal_type_studio", name: "Studio", sortOrder: 20 },
    },
    {
      id: "cal_unit_05",
      code: "C05",
      name: null,
      status: UnitStatus.INACTIVE,
      sortOrder: 10,
      unitType: null,
    },
  ];
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function seedStays(today: string): StaffCalendarStay[] {
  const tz = "Asia/Makassar";
  return [
    {
      id: `${CALENDAR_DEMO_STAY_PREFIX}budi`,
      unitId: "cal_unit_01",
      source: ReservationSource.MANUAL,
      status: ReservationStatus.CONFIRMED,
      checkInDate: today,
      checkOutDate: addDaysYmd(today, 4),
      guestName: "Budi Santoso",
      totalAmountIdr: 2_400_000,
      paidAmountIdr: 800_000,
      paymentStatus: PaymentStatus.DEPOSIT,
      collectedVia: CollectedVia.PROPERTY,
      icalSyncWarning: null,
      propertyTimezone: tz,
    },
    {
      id: `${CALENDAR_DEMO_STAY_PREFIX}sari`,
      unitId: "cal_unit_01",
      source: ReservationSource.BOOKING_COM,
      status: ReservationStatus.CONFIRMED,
      checkInDate: addDaysYmd(today, 4),
      checkOutDate: addDaysYmd(today, 7),
      guestName: "Sari Wijaya",
      totalAmountIdr: 1_800_000,
      paidAmountIdr: 1_800_000,
      paymentStatus: PaymentStatus.PAID,
      collectedVia: CollectedVia.CHANNEL,
      icalSyncWarning: null,
      propertyTimezone: tz,
    },
    {
      id: `${CALENDAR_DEMO_STAY_PREFIX}andi`,
      unitId: "cal_unit_02",
      source: ReservationSource.WEBSITE,
      status: ReservationStatus.CHECKED_IN,
      checkInDate: addDaysYmd(today, -1),
      checkOutDate: addDaysYmd(today, 3),
      guestName: "Andi Pratama",
      totalAmountIdr: 1_500_000,
      paidAmountIdr: 1_500_000,
      paymentStatus: PaymentStatus.PAID,
      collectedVia: CollectedVia.PROPERTY,
      icalSyncWarning: null,
      propertyTimezone: tz,
    },
    {
      id: `${CALENDAR_DEMO_STAY_PREFIX}airbnb`,
      unitId: "cal_unit_03",
      source: ReservationSource.AIRBNB,
      status: ReservationStatus.UNCONFIRMED,
      checkInDate: addDaysYmd(today, 1),
      checkOutDate: addDaysYmd(today, 5),
      guestName: "Guest (iCal)",
      totalAmountIdr: null,
      paidAmountIdr: 0,
      paymentStatus: PaymentStatus.UNPAID,
      collectedVia: null,
      icalSyncWarning: IcalSyncWarning.MISSING_FROM_FEED,
      propertyTimezone: tz,
    },
  ];
}

function seedBlocks(propertyId: string, today: string): StaffCalendarBlock[] {
  const now = new Date().toISOString();
  return [
    {
      id: "cal_block_maint",
      propertyId,
      unitId: "cal_unit_02",
      kind: CalendarBlockKind.MAINTENANCE,
      startDate: addDaysYmd(today, 5),
      endDate: addDaysYmd(today, 8),
      note: "AC service",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "cal_block_owner",
      propertyId,
      unitId: "cal_unit_03",
      kind: CalendarBlockKind.OWNER,
      startDate: addDaysYmd(today, 8),
      endDate: addDaysYmd(today, 10),
      note: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function getOrCreateStore(propertyId: string, today: string): PropertyStore {
  let store = stores.get(propertyId);
  if (!store) {
    store = {
      units: seedUnits(),
      stays: seedStays(today),
      blocks: seedBlocks(propertyId, today),
      liveStays: [],
    };
    stores.set(propertyId, store);
  }
  return store;
}

/** Browser-local today YYYY-MM-DD for seeding relative demo bars. */
function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fixtureGetPropertyCalendar(input: {
  propertyId: string;
  from: string;
  to: string;
}): Promise<StaffPropertyCalendar> {
  await Promise.resolve();
  const store = getOrCreateStore(input.propertyId, todayYmd());
  const stays = [...store.stays, ...store.liveStays].filter((s) =>
    rangeOverlapsWindow(s.checkInDate, s.checkOutDate, input.from, input.to),
  );
  const blocks = store.blocks.filter((b) =>
    rangeOverlapsWindow(b.startDate, b.endDate, input.from, input.to),
  );
  return {
    propertyId: input.propertyId,
    from: input.from,
    to: input.to,
    units: store.units,
    stays,
    blocks,
  };
}

/** After live reservation create — paint the new stay on the fixture grid. */
export function fixtureAppendLiveStay(
  propertyId: string,
  stay: StaffCalendarStay,
): void {
  const store = getOrCreateStore(propertyId, todayYmd());
  store.liveStays = store.liveStays.filter((s) => s.id !== stay.id);
  store.liveStays.push(stay);
}

function assertNoOverlap(
  store: PropertyStore,
  unitId: string,
  startDate: string,
  endDate: string,
  excludeBlockId?: string,
): void {
  for (const stay of [...store.stays, ...store.liveStays]) {
    if (stay.unitId !== unitId) continue;
    if (overlaps(startDate, endDate, stay.checkInDate, stay.checkOutDate)) {
      throw new ApiError({
        status: 409,
        code: ApiErrorCode.CONFLICT,
        message: `Overlaps stay “${stay.guestName}” (${stay.checkInDate} → ${stay.checkOutDate}).`,
        details: {
          field: "startDate",
          reason: ApiFieldReason.OVERLAP_CONFLICT,
          conflictingReservation: {
            id: stay.id,
            guestName: stay.guestName,
            source: stay.source,
            checkInDate: stay.checkInDate,
            checkOutDate: stay.checkOutDate,
            status: stay.status,
          },
        },
      });
    }
  }
  for (const block of store.blocks) {
    if (block.unitId !== unitId) continue;
    if (excludeBlockId && block.id === excludeBlockId) continue;
    if (overlaps(startDate, endDate, block.startDate, block.endDate)) {
      throw new ApiError({
        status: 409,
        code: ApiErrorCode.CONFLICT,
        message: `Overlaps ${block.kind.toLowerCase()} block (${block.startDate} → ${block.endDate}).`,
        details: {
          field: "startDate",
          reason: ApiFieldReason.OVERLAP_CONFLICT,
        },
      });
    }
  }
}

export async function fixtureCreateCalendarBlock(
  input: CreateStaffCalendarBlockInput,
): Promise<StaffCalendarBlock> {
  await Promise.resolve();
  if (input.endDate <= input.startDate) {
    throw new ApiError({
      status: 400,
      code: ApiErrorCode.VALIDATION_FAILED,
      message: "End date must be after start date.",
    });
  }
  const store = getOrCreateStore(input.propertyId, todayYmd());
  const unit = store.units.find((u) => u.id === input.unitId);
  if (!unit) {
    throw new ApiError({
      status: 404,
      code: ApiErrorCode.NOT_FOUND,
      message: "Unit not found on this calendar.",
    });
  }
  assertNoOverlap(store, input.unitId, input.startDate, input.endDate);
  const now = new Date().toISOString();
  const block: StaffCalendarBlock = {
    id: `cal_block_${Date.now().toString(36)}`,
    propertyId: input.propertyId,
    unitId: input.unitId,
    kind: input.kind,
    startDate: input.startDate,
    endDate: input.endDate,
    note: input.note?.trim() ? input.note.trim() : null,
    createdAt: now,
    updatedAt: now,
  };
  store.blocks.push(block);
  return block;
}

export async function fixtureUpdateCalendarBlock(
  id: string,
  input: UpdateStaffCalendarBlockInput,
): Promise<StaffCalendarBlock> {
  await Promise.resolve();
  for (const store of stores.values()) {
    const idx = store.blocks.findIndex((b) => b.id === id);
    if (idx < 0) continue;
    const current = store.blocks[idx]!;
    const next: StaffCalendarBlock = {
      ...current,
      unitId: input.unitId ?? current.unitId,
      kind: input.kind ?? current.kind,
      startDate: input.startDate ?? current.startDate,
      endDate: input.endDate ?? current.endDate,
      note:
        input.note === undefined
          ? current.note
          : input.note?.trim()
            ? input.note.trim()
            : null,
      updatedAt: new Date().toISOString(),
    };
    if (next.endDate <= next.startDate) {
      throw new ApiError({
        status: 400,
        code: ApiErrorCode.VALIDATION_FAILED,
        message: "End date must be after start date.",
      });
    }
    assertNoOverlap(
      store,
      next.unitId,
      next.startDate,
      next.endDate,
      next.id,
    );
    store.blocks[idx] = next;
    return next;
  }
  throw new ApiError({
    status: 404,
    code: ApiErrorCode.NOT_FOUND,
    message: "Calendar block not found.",
  });
}

export async function fixtureDeleteCalendarBlock(id: string): Promise<void> {
  await Promise.resolve();
  for (const store of stores.values()) {
    const idx = store.blocks.findIndex((b) => b.id === id);
    if (idx < 0) continue;
    store.blocks.splice(idx, 1);
    return;
  }
  throw new ApiError({
    status: 404,
    code: ApiErrorCode.NOT_FOUND,
    message: "Calendar block not found.",
  });
}
