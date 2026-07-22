import type { StaffCalendarUnit } from "@cabin/api-contract";
import { addDaysYmd } from "./calendar-layout";

export type CalendarSelection = {
  unitId: string;
  /** Inclusive check-in YYYY-MM-DD. */
  checkInDate: string;
  /** Exclusive check-out YYYY-MM-DD. */
  checkOutDate: string;
};

export type DragState = {
  unitId: string;
  anchorYmd: string;
  hoverYmd: string;
};

export function selectionFromDrag(drag: DragState): CalendarSelection {
  const a = drag.anchorYmd;
  const b = drag.hoverYmd;
  const start = a <= b ? a : b;
  const end = a <= b ? b : a;
  return {
    unitId: drag.unitId,
    checkInDate: start,
    checkOutDate: addDaysYmd(end, 1),
  };
}

export function isDayInSelection(
  unitId: string,
  ymd: string,
  drag: DragState | null,
  pending: CalendarSelection | null,
): boolean {
  if (drag && drag.unitId === unitId) {
    const a = drag.anchorYmd;
    const b = drag.hoverYmd;
    const start = a <= b ? a : b;
    const end = a <= b ? b : a;
    return ymd >= start && ymd <= end;
  }
  if (pending && pending.unitId === unitId) {
    return ymd >= pending.checkInDate && ymd < pending.checkOutDate;
  }
  return false;
}

export function unitLabel(unit: StaffCalendarUnit): string {
  return unit.name ? `${unit.code} · ${unit.name}` : unit.code;
}
