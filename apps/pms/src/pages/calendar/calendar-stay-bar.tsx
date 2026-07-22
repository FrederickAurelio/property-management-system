/* anchor: Linear-dense stay bar, diverge: source tint + compact due cue */
import type { CSSProperties } from "react";
import {
  balanceDueIdr,
  isPlaceholderGuestName,
  refundDueIdr,
  type ReservationSource,
  type StaffCalendarStay,
} from "@cabin/api-contract";
import { cn } from "@/lib/utils";
import {
  formatIdr,
  formatReservationLateCue,
  formatReservationSource,
  formatReservationStatus,
  reservationLateCue,
} from "@/pages/reservations/reservation-format";

const sourceBarClass: Record<ReservationSource, string> = {
  MANUAL: "border-border bg-muted text-foreground dark:bg-muted/80",
  WEBSITE:
    "border-slate-500/35 bg-slate-500/15 text-slate-950 dark:border-slate-400/40 dark:bg-slate-400/20 dark:text-slate-50",
  BOOKING_COM:
    "border-sky-600/40 bg-sky-500/20 text-sky-950 dark:border-sky-400/45 dark:bg-sky-400/20 dark:text-sky-50",
  AIRBNB:
    "border-rose-600/40 bg-rose-500/20 text-rose-950 dark:border-rose-400/45 dark:bg-rose-400/20 dark:text-rose-50",
  AGODA:
    "border-teal-700/40 bg-teal-500/20 text-teal-950 dark:border-teal-400/45 dark:bg-teal-400/20 dark:text-teal-50",
};

function stayPrimaryLabel(stay: StaffCalendarStay): string {
  if (
    stay.status === "UNCONFIRMED" &&
    isPlaceholderGuestName(stay.guestName)
  ) {
    return `Needs details (${formatReservationSource(stay.source)})`;
  }
  return stay.guestName;
}

function moneyCue(stay: StaffCalendarStay): string | null {
  const due = balanceDueIdr(stay.totalAmountIdr, stay.paidAmountIdr);
  if (due != null && due > 0) {
    return `Due ${formatIdr(due)}`;
  }
  const refund = refundDueIdr(stay.totalAmountIdr, stay.paidAmountIdr);
  if (refund != null && refund > 0) {
    return `Refund ${formatIdr(refund)}`;
  }
  return null;
}

type CalendarStayBarProps = {
  stay: StaffCalendarStay;
  style: CSSProperties;
  /** Interval continues before the visible window — sharp flush left. */
  clippedStart?: boolean;
  /** Interval continues after the visible window — sharp flush right. */
  clippedEnd?: boolean;
  onClick: () => void;
};

export function CalendarStayBar({
  stay,
  style,
  clippedStart = false,
  clippedEnd = false,
  onClick,
}: CalendarStayBarProps) {
  const late = reservationLateCue(stay);
  const money = moneyCue(stay);
  const label = stayPrimaryLabel(stay);

  return (
    <button
      type="button"
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute top-1 bottom-1 z-10 flex min-w-0 items-center gap-1 overflow-hidden border px-1.5 text-left text-[11px] leading-tight shadow-sm transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !clippedStart && !clippedEnd && "rounded-md",
        clippedStart && clippedEnd && "rounded-none border-x-0",
        clippedStart && !clippedEnd && "rounded-r-md rounded-l-none border-l-0",
        clippedEnd && !clippedStart && "rounded-l-md rounded-r-none border-r-0",
        sourceBarClass[stay.source],
      )}
      title={[
        label,
        formatReservationStatus(stay.status),
        formatReservationSource(stay.source),
        money,
        late ? formatReservationLateCue(late) : null,
        stay.icalSyncWarning ? "iCal warning" : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <span className="min-w-0 truncate font-medium">{label}</span>
      {late && (
        <span className="shrink-0 rounded bg-amber-500/25 px-1 text-[10px] font-medium">
          Late
        </span>
      )}
      {stay.icalSyncWarning && (
        <span className="shrink-0 rounded bg-amber-500/25 px-1 text-[10px] font-medium">
          iCal
        </span>
      )}
      {money && (
        <span className="ml-auto hidden shrink-0 tabular-nums sm:inline">
          {money}
        </span>
      )}
    </button>
  );
}
