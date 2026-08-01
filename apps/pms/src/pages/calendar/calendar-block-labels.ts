import { CalendarBlockKind } from "@cabin/api-contract";
import i18n from "@/i18n";

export function formatBlockKind(kind: CalendarBlockKind): string {
  switch (kind) {
    case CalendarBlockKind.MAINTENANCE:
      return i18n.t("calendar:blockLabels.maintenance");
    case CalendarBlockKind.OWNER:
      return i18n.t("calendar:blockLabels.owner");
    case CalendarBlockKind.HOLD:
      return i18n.t("calendar:blockLabels.hold");
    case CalendarBlockKind.OTHER:
      return i18n.t("calendar:blockLabels.other");
    default:
      return kind;
  }
}
