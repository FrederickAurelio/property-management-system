import { CalendarBlockKind } from "@cabin/api-contract";

export function formatBlockKind(kind: CalendarBlockKind): string {
  switch (kind) {
    case CalendarBlockKind.MAINTENANCE:
      return "Maintenance";
    case CalendarBlockKind.OWNER:
      return "Owner";
    case CalendarBlockKind.HOLD:
      return "Hold";
    case CalendarBlockKind.OTHER:
      return "Block";
    default:
      return kind;
  }
}
