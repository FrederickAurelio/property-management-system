import {
  CalendarBlockKind,
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  type StaffCalendarBlock,
  type StaffCalendarStay,
  type StaffPropertyCalendar,
} from "@cabin/api-contract";
import { describe, expect, it } from "vitest";
import { occupancyExtrasForUnit } from "./calendar-occupancy";

function stay(
  patch: Pick<
    StaffCalendarStay,
    "id" | "status" | "checkInDate" | "checkOutDate"
  >,
): StaffCalendarStay {
  return {
    unitId: "u1",
    source: ReservationSource.MANUAL,
    inventoryEndDate: patch.checkOutDate,
    guestName: "Budi",
    totalAmountIdr: 500_000,
    paidAmountIdr: 0,
    paymentStatus: PaymentStatus.UNPAID,
    collectedVia: null,
    icalSyncWarning: null,
    propertyTimezone: "Asia/Jakarta",
    ...patch,
  };
}

function block(
  patch: Pick<StaffCalendarBlock, "id" | "startDate" | "endDate">,
): StaffCalendarBlock {
  return {
    propertyId: "p1",
    unitId: "u1",
    kind: CalendarBlockKind.MAINTENANCE,
    note: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...patch,
  };
}

describe("occupancyExtrasForUnit", () => {
  const calendar: StaffPropertyCalendar = {
    propertyId: "p1",
    from: "2026-08-01",
    to: "2026-08-15",
    units: [],
    stays: [
      stay({
        id: "live",
        status: ReservationStatus.CONFIRMED,
        checkInDate: "2026-08-02",
        checkOutDate: "2026-08-05",
      }),
      stay({
        id: "history",
        status: ReservationStatus.CHECKED_OUT,
        checkInDate: "2026-08-06",
        checkOutDate: "2026-08-08",
      }),
    ],
    blocks: [
      block({
        id: "blk",
        startDate: "2026-08-10",
        endDate: "2026-08-12",
      }),
    ],
  };

  it("omits checked-out history so those nights stay free", () => {
    const extras = occupancyExtrasForUnit(calendar, "u1");
    expect(extras.map((b) => b.reservationId)).toEqual(["live", "blk"]);
  });

  it("omits the calendar block being edited so those nights stay selectable", () => {
    const extras = occupancyExtrasForUnit(calendar, "u1", "blk");
    expect(extras.map((b) => b.reservationId)).toEqual(["live"]);
  });
});
