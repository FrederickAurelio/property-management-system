import type {
  StaffPropertyCalendar,
  UnitOccupancyBlock,
} from "@cabin/api-contract";

/** Map calendar aggregate busy intervals into StayDateRangePicker extras. */
export function occupancyExtrasForUnit(
  calendar: StaffPropertyCalendar | undefined,
  unitId: string | undefined,
): UnitOccupancyBlock[] {
  if (!calendar || !unitId) return [];
  const stays: UnitOccupancyBlock[] = calendar.stays
    .filter((s) => s.unitId === unitId)
    .map((s) => ({
      reservationId: s.id,
      checkInDate: s.checkInDate,
      checkOutDate: s.checkOutDate,
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
