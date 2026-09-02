/* anchor: Linear-dense / Stripe-data calendar, diverge: checkout as a thin outlined rail — not a stay chip, not a hatched block */
import type { CSSProperties } from "react";
import type { StaffCalendarStay } from "@cabin/api-contract";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  formatReservationSource,
  formatReservationStatus,
} from "@/pages/reservations/reservation-format";
import { stayPrimaryLabel } from "./calendar-stay-label";

type CalendarHistoryRailProps = {
  stay: StaffCalendarStay;
  style: CSSProperties;
  clippedStart?: boolean;
  clippedEnd?: boolean;
  onClick: () => void;
};

export function CalendarHistoryRail({
  stay,
  style,
  clippedStart = false,
  clippedEnd = false,
  onClick,
}: CalendarHistoryRailProps) {
  const { t } = useTranslation("calendar");
  const label = stayPrimaryLabel(stay, t);

  return (
    <button
      type="button"
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute bottom-1 z-1 flex h-5 min-w-0 items-center overflow-hidden border border-dashed border-muted-foreground/40 bg-transparent px-1.5 text-left text-[10px] leading-none text-muted-foreground hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        !clippedStart && !clippedEnd && "rounded-md",
        clippedStart && clippedEnd && "rounded-none border-x-0",
        clippedStart && !clippedEnd && "rounded-l-none rounded-r-md border-l-0",
        clippedEnd && !clippedStart && "rounded-l-md rounded-r-none border-r-0",
      )}
      title={[
        label,
        formatReservationStatus(stay.status),
        formatReservationSource(stay.source),
      ].join(" · ")}
    >
      <span className="min-w-0 truncate font-normal">
        {label}
        <span className="text-muted-foreground/70">
          {" · "}
          {t("calendar:stayBar.checkedOut")}
        </span>
      </span>
    </button>
  );
}
