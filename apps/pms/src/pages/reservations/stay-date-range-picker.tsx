/* anchor: shadcn date-picker range, diverge: occupancy + Confirm; inline panel in form */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import type { DateRange, Matcher } from "react-day-picker";
import type { UnitOccupancyBlock } from "@cabin/api-contract";
import { QueryErrorPanel } from "@/components/query-error-panel";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { getUnitMonthOccupancy, staffUnitOccupancyQueryKey } from "@/lib/api";
import { cn } from "@/lib/utils";
import { nightCount } from "./reservation-format";

function ymdToDate(ymd: string): Date | undefined {
  if (!ymd) {
    return undefined;
  }
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) {
    return undefined;
  }
  return new Date(y, m - 1, d);
}

function dateToYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function yearMonthOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const base = ymdToDate(ymd);
  if (!base) {
    return ymd;
  }
  base.setDate(base.getDate() + days);
  return dateToYmd(base);
}

function rangeFromYmd(
  checkInDate: string,
  checkOutDate: string,
): DateRange | undefined {
  if (!checkInDate && !checkOutDate) {
    return undefined;
  }
  return {
    from: ymdToDate(checkInDate),
    to: ymdToDate(checkOutDate),
  };
}

function formatRangeLabel(
  checkInDate: string,
  checkOutDate: string,
  emptyLabel: string,
): string {
  if (checkInDate && checkOutDate) {
    return `${format(ymdToDate(checkInDate)!, "LLL d, y")} → ${format(ymdToDate(checkOutDate)!, "LLL d, y")}`;
  }
  if (checkInDate) {
    return `${format(ymdToDate(checkInDate)!, "LLL d, y")} → …`;
  }
  return emptyLabel;
}

/** Nights in [checkIn, checkOut) — exclusive checkout. */
function expandBlockedNights(blocks: UnitOccupancyBlock[]): Set<string> {
  const nights = new Set<string>();
  for (const block of blocks) {
    let cursor = block.checkInDate;
    while (cursor < block.checkOutDate) {
      nights.add(cursor);
      cursor = addDaysYmd(cursor, 1);
    }
  }
  return nights;
}

function rangeHasBlockedNight(
  checkInYmd: string,
  checkOutYmd: string,
  blockedNights: Set<string>,
): boolean {
  let cursor = checkInYmd;
  while (cursor < checkOutYmd) {
    if (blockedNights.has(cursor)) {
      return true;
    }
    cursor = addDaysYmd(cursor, 1);
  }
  return false;
}

type StayDateRangePickerProps = {
  checkInDate: string;
  checkOutDate: string;
  onChange: (next: { checkInDate: string; checkOutDate: string }) => void;
  invalid?: boolean;
  id?: string;
  /** When set, calendar loads month occupancy and blocks booked nights. */
  unitId?: string;
  excludeReservationId?: string;
  /**
   * Extra busy intervals merged into blocked nights (e.g. calendar
   * aggregate stays + blocks). `reservationId` is any opaque interval id.
   */
  extraOccupancyBlocks?: UnitOccupancyBlock[];
  /** Omit this interval id from `extraOccupancyBlocks` (edit self). */
  excludeOccupancyId?: string;
  /**
   * Copy variant — `block` uses start/end wording instead of check-in/out.
   * Default `stay` keeps reservation desk language.
   */
  copy?: "stay" | "block";
};

const COPY = {
  stay: {
    panelLabel: "Stay dates",
    emptyTrigger: "Pick check-in and check-out",
    bookedNight: "Booked night",
    bookedNightHint: " · can’t check in",
    turnaround: "Turnaround",
    turnaroundHint: " · OK as check-out (same-day)",
    chooseUnit: "Choose a unit to see booked nights on this calendar.",
    pickStart: "Pick check-in, then check-out",
    pickEnd: "Pick check-out to finish the range",
    exclusive: " · check-out is exclusive",
    busyNoun: "a booked night",
    clearDates: "Clear dates",
  },
  block: {
    panelLabel: "Block dates",
    emptyTrigger: "Pick start and end",
    bookedNight: "Busy night",
    bookedNightHint: " · can’t start here",
    turnaround: "Turnaround",
    turnaroundHint: " · OK as exclusive end (same-day)",
    chooseUnit: "Choose a unit to see busy nights on this calendar.",
    pickStart: "Pick start, then end",
    pickEnd: "Pick end to finish the range",
    exclusive: " · end is exclusive",
    busyNoun: "a busy night",
    clearDates: "Clear dates",
  },
} as const;

export function StayDateRangePicker({
  checkInDate,
  checkOutDate,
  onChange,
  invalid = false,
  id = "stay-dates",
  unitId,
  excludeReservationId,
  extraOccupancyBlocks,
  excludeOccupancyId,
  copy = "stay",
}: StayDateRangePickerProps) {
  const labels = COPY[copy];
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  /** Draft while the popover is open — form values only update on Confirm. */
  const [draft, setDraft] = useState<DateRange | undefined>(() =>
    rangeFromYmd(checkInDate, checkOutDate),
  );
  const [displayMonth, setDisplayMonth] = useState<Date>(
    () => ymdToDate(checkInDate) ?? new Date(),
  );

  const monthCount = isMobile ? 1 : 2;
  const visibleYearMonths = useMemo(() => {
    const months: string[] = [];
    for (let i = 0; i < monthCount; i += 1) {
      months.push(yearMonthOf(addMonths(displayMonth, i)));
    }
    return months;
  }, [displayMonth, monthCount]);

  const occupancyQueries = useQueries({
    queries: visibleYearMonths.map((yearMonth) => ({
      queryKey: staffUnitOccupancyQueryKey(unitId ?? "", {
        yearMonth,
        ...(excludeReservationId ? { excludeReservationId } : {}),
      }),
      queryFn: () =>
        getUnitMonthOccupancy(unitId!, {
          yearMonth,
          ...(excludeReservationId ? { excludeReservationId } : {}),
        }),
      enabled: open && Boolean(unitId),
      staleTime: 0,
    })),
  });

  const apiBlocks = occupancyQueries.flatMap((q) => q.data?.blocks ?? []);
  const extraBlocks = (extraOccupancyBlocks ?? []).filter(
    (b) => !excludeOccupancyId || b.reservationId !== excludeOccupancyId,
  );
  const blockedNights = expandBlockedNights([...apiBlocks, ...extraBlocks]);

  /** Hide calendar until every visible month has occupancy data. */
  const occupancyPending =
    Boolean(unitId) &&
    open &&
    occupancyQueries.some((q) => q.isPending || (!q.data && q.isFetching));

  const occupancyError =
    Boolean(unitId) && open && occupancyQueries.some((q) => q.isError);

  const occupancyRetrying =
    occupancyError && occupancyQueries.some((q) => q.isFetching);

  const committedNights =
    checkInDate && checkOutDate ? nightCount(checkInDate, checkOutDate) : 0;

  const draftFrom = draft?.from ? dateToYmd(draft.from) : "";
  const draftTo = draft?.to ? dateToYmd(draft.to) : "";
  const draftComplete = Boolean(draftFrom && draftTo) && draftFrom !== draftTo;
  const draftNights = draftComplete ? nightCount(draftFrom, draftTo) : 0;
  const draftOverlapsBusy =
    draftComplete &&
    Boolean(unitId) &&
    rangeHasBlockedNight(draftFrom, draftTo, blockedNights);
  const canConfirm =
    draftComplete &&
    draftNights >= 1 &&
    !draftOverlapsBusy &&
    !occupancyError &&
    !occupancyPending;

  /**
   * RDP sets `{ from, to: same day }` on first click unless min>0.
   * Same-day / missing `to` = still picking check-out.
   */
  const pickingCheckOut =
    Boolean(draftFrom) && (!draftTo || draftTo === draftFrom);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const nextDraft = rangeFromYmd(checkInDate, checkOutDate);
      setDraft(nextDraft);
      setDisplayMonth(nextDraft?.from ?? ymdToDate(checkInDate) ?? new Date());
    } else {
      setDraft(rangeFromYmd(checkInDate, checkOutDate));
    }
    setOpen(next);
  };

  const handleConfirm = () => {
    if (!canConfirm || !draft?.from || !draft.to) {
      return;
    }
    onChange({
      checkInDate: dateToYmd(draft.from),
      checkOutDate: dateToYmd(draft.to),
    });
    setOpen(false);
  };

  const hasCommittedRange = Boolean(checkInDate || checkOutDate);
  const hasDraftRange = Boolean(draftFrom);

  const handleClear = () => {
    setDraft(undefined);
    onChange({ checkInDate: "", checkOutDate: "" });
  };

  /**
   * Do NOT put booked nights in `disabled` — RDP makes disabled days
   * unclickable, but exclusive checkout may land on the next guest’s
   * check-in day (e.g. end on 22 when 22–24 is booked). Validate in onSelect.
   */
  const disabledMatcher: Matcher | Matcher[] = (date) => {
    if (!pickingCheckOut || !draftFrom) {
      return false;
    }
    // Only block dates on/before check-in while choosing check-out.
    return dateToYmd(date) <= draftFrom;
  };

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      setDraft(undefined);
      return;
    }

    const fromYmd = dateToYmd(range.from);
    const toYmd = range.to ? dateToYmd(range.to) : "";
    const incomplete = !toYmd || toYmd === fromYmd;

    if (incomplete) {
      // Check-in cannot start on an occupied night.
      if (unitId && blockedNights.has(fromYmd)) {
        return;
      }
      setDraft({ from: range.from, to: undefined });
      return;
    }

    if (toYmd <= fromYmd) {
      setDraft({ from: range.from, to: undefined });
      return;
    }

    // Allow selecting an overlapping end so the click registers and the
    // overlap hint / Confirm-disabled state can show (do not swallow the click).
    setDraft(range);
  };

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open]);

  const triggerButton = (
    <div className="flex w-full gap-1.5">
      <Button
        type="button"
        variant="outline"
        id={id}
        aria-invalid={invalid}
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        data-empty={!checkInDate || !checkOutDate}
        className={cn(
          "min-w-0 flex-1 justify-start px-2.5 font-normal",
          "data-[empty=true]:text-muted-foreground",
        )}
        onClick={() => {
          handleOpenChange(!open);
        }}
      >
        <CalendarIcon data-icon="inline-start" />
        <span className="truncate">
          {formatRangeLabel(checkInDate, checkOutDate, labels.emptyTrigger)}
        </span>
      </Button>
      {hasCommittedRange && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label={labels.clearDates}
          onClick={() => {
            handleClear();
            setOpen(false);
          }}
        >
          <XIcon />
        </Button>
      )}
    </div>
  );

  const panel = occupancyError ? (
    <div className="w-full p-3 sm:w-[22rem]">
      <QueryErrorPanel
        message="Couldn’t load booked nights for this unit. Try again."
        onRetry={() => {
          for (const q of occupancyQueries) {
            void q.refetch();
          }
        }}
        isRetrying={occupancyRetrying}
      />
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            handleOpenChange(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  ) : occupancyPending ? (
    <div aria-busy aria-label="Loading booked nights">
      {/* Mirrors Calendar: p-2, months gap-4, cell-size = spacing(7) */}
      <div className="flex justify-center bg-background p-2 [--cell-size:--spacing(7)]">
        <div
          className={cn(
            "relative flex gap-4",
            monthCount === 1 ? "flex-col" : "flex-col md:flex-row",
          )}
        >
          {/* Nav chevrons — same absolute slot as real Calendar */}
          <div className="absolute inset-x-0 top-0 z-10 flex w-full items-center justify-between">
            <Skeleton className="size-(--cell-size) rounded-md" />
            <Skeleton className="size-(--cell-size) rounded-md" />
          </div>
          {Array.from({ length: monthCount }).map((_, monthIdx) => (
            <div
              key={monthIdx}
              className="flex w-[calc(var(--cell-size)*7)] flex-col gap-4"
            >
              <div className="flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)">
                <Skeleton className="h-4 w-24" />
              </div>
              <div>
                <div className="flex w-full">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={`w-${i}`}
                      className="flex flex-1 items-center justify-center"
                    >
                      <Skeleton className="h-3 w-4 rounded-sm" />
                    </div>
                  ))}
                </div>
                {Array.from({ length: 6 }).map((_, weekIdx) => (
                  <div key={`week-${weekIdx}`} className="mt-2 flex w-full">
                    {Array.from({ length: 7 }).map((_, dayIdx) => (
                      <div
                        key={`d-${weekIdx}-${dayIdx}`}
                        className="aspect-square min-w-(--cell-size) flex-1 p-0"
                      >
                        <Skeleton className="size-full rounded-md" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5">
        {unitId ? (
          <div className="flex items-center gap-2">
            <Skeleton className="size-3.5 shrink-0 rounded-sm" />
            <Skeleton className="h-3 w-40" />
          </div>
        ) : null}
        <Skeleton className="h-3 w-52" />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              handleOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" disabled>
            Confirm dates
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <>
      <div className="flex justify-center">
        <Calendar
          mode="range"
          min={1}
          resetOnSelect
          numberOfMonths={monthCount}
          month={displayMonth}
          onMonthChange={setDisplayMonth}
          selected={draft}
          onSelect={handleSelect}
          disabled={disabledMatcher}
          modifiers={{
            occupied: (date) => {
              if (!unitId) {
                return false;
              }
              const ymd = dateToYmd(date);
              if (!blockedNights.has(ymd)) {
                return false;
              }
              // While picking check-out, a valid exclusive end is turnaround — not “blocked”.
              if (
                pickingCheckOut &&
                draftFrom &&
                ymd > draftFrom &&
                !rangeHasBlockedNight(draftFrom, ymd, blockedNights)
              ) {
                return false;
              }
              return true;
            },
            turnaround: (date) => {
              if (!unitId || !pickingCheckOut || !draftFrom) {
                return false;
              }
              const ymd = dateToYmd(date);
              if (!blockedNights.has(ymd) || ymd <= draftFrom) {
                return false;
              }
              // Next guest’s check-in day — OK as our check-out.
              return !rangeHasBlockedNight(draftFrom, ymd, blockedNights);
            },
          }}
          components={{
            DayButton: ({ className, modifiers, disabled, ...props }) => (
              <CalendarDayButton
                {...props}
                modifiers={modifiers}
                disabled={
                  Boolean(disabled) &&
                  !modifiers.occupied &&
                  !modifiers.turnaround
                }
                className={cn(
                  className,
                  modifiers.today &&
                    !modifiers.occupied &&
                    !modifiers.turnaround &&
                    !modifiers.selected &&
                    !modifiers.range_start &&
                    !modifiers.range_end &&
                    !modifiers.range_middle &&
                    cn(
                      "bg-primary/10! font-semibold text-primary!",
                      "hover:bg-primary/15! hover:text-primary!",
                    ),
                  modifiers.occupied &&
                    cn(
                      "bg-destructive/20! text-destructive! opacity-100!",
                      "font-medium line-through shadow-none",
                      "hover:bg-destructive/25! hover:text-destructive!",
                    ),
                  modifiers.turnaround &&
                    cn(
                      "bg-background! text-foreground! opacity-100!",
                      "font-semibold shadow-none",
                      "border border-destructive/40",
                      "hover:bg-muted/60!",
                      "cursor-pointer",
                    ),
                )}
              />
            ),
          }}
        />
      </div>
      <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5">
        {unitId ? (
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex size-3.5 shrink-0 rounded-sm bg-destructive/25 ring-1 ring-destructive/40"
                aria-hidden
              />
              <span className="text-muted-foreground">
                <span className="font-medium text-destructive">
                  {labels.bookedNight}
                </span>
                {labels.bookedNightHint}
              </span>
            </div>
            {pickingCheckOut && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex size-3.5 shrink-0 rounded-sm border border-destructive/40 bg-background"
                  aria-hidden
                />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {labels.turnaround}
                  </span>
                  {labels.turnaroundHint}
                </span>
              </div>
            )}
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {!unitId ? (
            labels.chooseUnit
          ) : draftOverlapsBusy ? (
            <>
              That range{" "}
              <span className="font-medium text-destructive">overlaps</span>{" "}
              {labels.busyNoun} — pick another.
            </>
          ) : draftComplete ? (
            `${draftNights === 1 ? "1 night" : `${draftNights} nights`}${labels.exclusive}`
          ) : draftFrom ? (
            labels.pickEnd
          ) : (
            labels.pickStart
          )}
        </p>
        <div className="flex items-center justify-between gap-2">
          {(hasDraftRange || hasCommittedRange) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleClear}
            >
              {labels.clearDates}
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                handleOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              Confirm dates
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-1.5 text-foreground">
      {triggerButton}
      {open && (
        <div
          ref={panelRef}
          id={`${id}-panel`}
          role="region"
          aria-label={labels.panelLabel}
          className="overflow-hidden rounded-lg bg-popover text-foreground ring-1 ring-foreground/10"
        >
          {panel}
        </div>
      )}
      {committedNights > 0 && (
        <p className="text-xs text-muted-foreground">
          {committedNights === 1 ? "1 night" : `${committedNights} nights`}
          <span className="text-muted-foreground/80">{labels.exclusive}</span>
        </p>
      )}
    </div>
  );
}
