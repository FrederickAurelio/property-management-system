import {
  isOccupyingReservationStatus,
  type StaffPropertyCalendar,
  type UnitOccupancyBlock,
} from "@cabin/api-contract";

/** Map calendar aggregate busy intervals into StayDateRangePicker extras.
 *  Clip stay inventory ends to the calendar window so open monthly/yearly
 *  holds (FAR) are not day-expanded into millions of nights.
 *  Checked-out history stays are paint-only — omit them so nights stay free. */
export function occupancyExtrasForUnit(
  calendar: StaffPropertyCalendar | undefined,
  unitId: string | undefined,
): UnitOccupancyBlock[] {
  if (!calendar || !unitId) return [];
  const clipUntil = calendar.to;
  const stays: UnitOccupancyBlock[] = calendar.stays
    .filter(
      (s) => s.unitId === unitId && isOccupyingReservationStatus(s.status),
    )
    .map((s) => ({
      reservationId: s.id,
      checkInDate: s.checkInDate,
      checkOutDate:
        s.inventoryEndDate < clipUntil ? s.inventoryEndDate : clipUntil,
      contractCheckOutDate: s.checkOutDate,
    }));
  const blocks: UnitOccupancyBlock[] = calendar.blocks
    .filter((b) => b.unitId === unitId)
    .map((b) => ({
      reservationId: b.id,
      checkInDate: b.startDate,
      checkOutDate: b.endDate,
    }));
  return [...stays, ...blocks];
}
