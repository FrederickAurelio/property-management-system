import {
  isPlaceholderGuestName,
  type StaffCalendarStay,
} from "@cabin/api-contract";
import type { TFunction } from "i18next";
import { formatReservationSource } from "@/pages/reservations/reservation-format";

export function stayPrimaryLabel(
  stay: StaffCalendarStay,
  t: TFunction,
): string {
  if (stay.status === "UNCONFIRMED" && isPlaceholderGuestName(stay.guestName)) {
    return t("calendar:stayBar.needsDetails", {
      source: formatReservationSource(stay.source),
    });
  }
  return stay.guestName;
}
