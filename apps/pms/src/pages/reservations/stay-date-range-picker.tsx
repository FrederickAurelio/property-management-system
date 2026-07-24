/* anchor: Linear-dense stay control, diverge: duration + Daily/Monthly/Yearly ToggleGroup */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import type { DateRange, Matcher } from "react-day-picker";
import {
  StayBillingPeriod,
  checkoutFromPeriodCount,
  periodCountFromRange,
  stayPeriodCountMax,
  type StayBillingPeriod as StayBillingPeriodType,
  type UnitOccupancyBlock,
} from "@cabin/api-contract";
import { QueryErrorPanel } from "@/components/query-error-panel";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { getUnitMonthOccupancy, staffUnitOccupancyQueryKey } from "@/lib/api";
import { cn } from "@/lib/utils";
import { nightCount, todayYmd } from "./reservation-format";

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

function dayOfMonthFromYmd(ymd: string, fallbackYmd: string): number {
  const parts = (ymd || fallbackYmd).split("-").map(Number);
  return parts[2] && parts[2] >= 1 ? parts[2] : 1;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function ymdFromYearMonthDay(year: number, month: number, day: number): string {
  const d = Math.min(day, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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

function durationUnitLabel(
  period: StayBillingPeriodType,
  count: number,
): string {
  if (period === StayBillingPeriod.MONTHLY) {
    return count === 1 ? "month" : "months";
  }
  if (period === StayBillingPeriod.YEARLY) {
    return count === 1 ? "year" : "years";
  }
  return count === 1 ? "night" : "nights";
}

type StayDateRangePickerProps = {
  checkInDate: string;
  checkOutDate: string;
  onChange: (next: { checkInDate: string; checkOutDate: string }) => void;
  billingPeriod?: StayBillingPeriodType;
  onBillingPeriodChange?: (period: StayBillingPeriodType) => void;
  /** Hide Daily/Monthly/Yearly (calendar blocks). Default true for stay. */
  showPeriodToggle?: boolean;
  invalid?: boolean;
  id?: string;
  unitId?: string;
  excludeReservationId?: string;
  extraOccupancyBlocks?: UnitOccupancyBlock[];
  excludeOccupancyId?: string;
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
    pickStartDaily: "Pick check-in, then check-out",
    pickEndDaily: "Pick check-out to finish the range",
    pickStartMonthly: "Pick start month, then end month",
    pickEndMonthly: "Pick end month to finish the range",
    pickStartYearly: "Pick start year, then end year",
    pickEndYearly: "Pick end year to finish the range",
    exclusive: " · check-out is exclusive",
    busyNoun: "a booked night",
    clearDates: "Clear dates",
    sameDateHint: " · same calendar date next period",
  },
  block: {
    panelLabel: "Block dates",
    emptyTrigger: "Pick start and end",
    bookedNight: "Busy night",
    bookedNightHint: " · can’t start here",
    turnaround: "Turnaround",
    turnaroundHint: " · OK as exclusive end (same-day)",
    chooseUnit: "Choose a unit to see busy nights on this calendar.",
    pickStartDaily: "Pick start, then end",
    pickEndDaily: "Pick end to finish the range",
    pickStartMonthly: "Pick start month, then end month",
    pickEndMonthly: "Pick end month to finish the range",
    pickStartYearly: "Pick start year, then end year",
    pickEndYearly: "Pick end year to finish the range",
    exclusive: " · end is exclusive",
    busyNoun: "a busy night",
    clearDates: "Clear dates",
    sameDateHint: "",
  },
} as const;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function StayDateRangePicker({
  checkInDate,
  checkOutDate,
  onChange,
  billingPeriod: billingPeriodProp,
  onBillingPeriodChange,
  showPeriodToggle = true,
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
  const period = billingPeriodProp ?? StayBillingPeriod.DAILY;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() =>
    rangeFromYmd(checkInDate, checkOutDate),
  );
  const [displayMonth, setDisplayMonth] = useState<Date>(
    () => ymdToDate(checkInDate) ?? new Date(),
  );
  const [monthPickerYear, setMonthPickerYear] = useState(
    () => (ymdToDate(checkInDate) ?? new Date()).getFullYear(),
  );
  const [yearPickerCenter, setYearPickerCenter] = useState(
    () => (ymdToDate(checkInDate) ?? new Date()).getFullYear(),
  );

  const committedCount =
    checkInDate && checkOutDate
      ? (periodCountFromRange(period, checkInDate, checkOutDate) ??
        (period === StayBillingPeriod.DAILY
          ? nightCount(checkInDate, checkOutDate)
          : 0))
      : 0;

  const committedKey = `${period}:${checkInDate}:${checkOutDate}`;
  const [duration, setDuration] = useState<number>(() =>
    committedCount >= 1 ? committedCount : 1,
  );
  const [durationText, setDurationText] = useState(() =>
    String(committedCount >= 1 ? committedCount : 1),
  );
  const [prevCommittedKey, setPrevCommittedKey] = useState(committedKey);
  // Adjust local duration when the committed range changes (open/edit/reset) —
  // preferred over syncing in an effect (avoids cascading renders).
  if (committedKey !== prevCommittedKey) {
    setPrevCommittedKey(committedKey);
    if (committedCount >= 1) {
      setDuration(committedCount);
      setDurationText(String(committedCount));
    }
  }
  /**
   * After duration auto-fills check-out, the next calendar click after
   * check-in is treated as choosing a new check-out (recalculates duration)
   * instead of starting a new stay stuck at the old night count.
   */
  const durationSuggestedRef = useRef(false);

  const syncDurationFromRange = (from: string, to: string) => {
    const count = periodCountFromRange(period, from, to);
    if (count != null && count >= 1) {
      setDuration(count);
      setDurationText(String(count));
    }
  };

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
      enabled: open && Boolean(unitId) && period === StayBillingPeriod.DAILY,
      staleTime: 0,
    })),
  });

  const apiBlocks = occupancyQueries.flatMap((q) => q.data?.blocks ?? []);
  const extraBlocks = (extraOccupancyBlocks ?? []).filter(
    (b) => !excludeOccupancyId || b.reservationId !== excludeOccupancyId,
  );
  const blockedNights = expandBlockedNights([...apiBlocks, ...extraBlocks]);

  const occupancyPending =
    Boolean(unitId) &&
    open &&
    period === StayBillingPeriod.DAILY &&
    occupancyQueries.some((q) => q.isPending || (!q.data && q.isFetching));

  const occupancyError =
    Boolean(unitId) &&
    open &&
    period === StayBillingPeriod.DAILY &&
    occupancyQueries.some((q) => q.isError);

  const occupancyRetrying =
    occupancyError && occupancyQueries.some((q) => q.isFetching);

  const draftFrom = draft?.from ? dateToYmd(draft.from) : "";
  const draftTo = draft?.to ? dateToYmd(draft.to) : "";
  const draftComplete = Boolean(draftFrom && draftTo) && draftFrom !== draftTo;
  const draftPeriodCount = draftComplete
    ? periodCountFromRange(period, draftFrom, draftTo)
    : null;
  const draftOverlapsBusy =
    draftComplete &&
    Boolean(unitId) &&
    rangeHasBlockedNight(draftFrom, draftTo, blockedNights);
  const canConfirm =
    draftComplete &&
    draftPeriodCount != null &&
    draftPeriodCount >= 1 &&
    !draftOverlapsBusy &&
    !occupancyError &&
    !occupancyPending;

  const pickingCheckOut =
    Boolean(draftFrom) && (!draftTo || draftTo === draftFrom);

  const pickStartHint =
    period === StayBillingPeriod.MONTHLY
      ? labels.pickStartMonthly
      : period === StayBillingPeriod.YEARLY
        ? labels.pickStartYearly
        : labels.pickStartDaily;
  const pickEndHint =
    period === StayBillingPeriod.MONTHLY
      ? labels.pickEndMonthly
      : period === StayBillingPeriod.YEARLY
        ? labels.pickEndYearly
        : labels.pickEndDaily;

  /**
   * Shared by day / month / year: first click = start + autofill end from
   * duration; next click after start = override end and recalculate duration.
   */
  const applyPeriodClick = (
    clickedYmd: string,
    opts: { checkOccupied?: boolean } = {},
  ) => {
    const prevFrom = draftFrom;
    const prevComplete = draftComplete;

    if (
      durationSuggestedRef.current &&
      prevComplete &&
      prevFrom &&
      clickedYmd > prevFrom
    ) {
      setDraft({
        from: ymdToDate(prevFrom),
        to: ymdToDate(clickedYmd),
      });
      durationSuggestedRef.current = false;
      syncDurationFromRange(prevFrom, clickedYmd);
      return;
    }

    if (opts.checkOccupied && unitId && blockedNights.has(clickedYmd)) {
      return;
    }

    if (duration >= 1) {
      const autoOut = checkoutFromPeriodCount(period, clickedYmd, duration);
      if (
        opts.checkOccupied &&
        unitId &&
        rangeHasBlockedNight(clickedYmd, autoOut, blockedNights)
      ) {
        setDraft({ from: ymdToDate(clickedYmd), to: undefined });
        durationSuggestedRef.current = false;
        return;
      }
      setDraft({
        from: ymdToDate(clickedYmd),
        to: ymdToDate(autoOut),
      });
      durationSuggestedRef.current = true;
      return;
    }

    setDraft({ from: ymdToDate(clickedYmd), to: undefined });
    durationSuggestedRef.current = false;
  };

  const handlePeriodChange = (next: string) => {
    if (
      next !== StayBillingPeriod.DAILY &&
      next !== StayBillingPeriod.MONTHLY &&
      next !== StayBillingPeriod.YEARLY
    ) {
      return;
    }
    if (next === period) {
      return;
    }
    onBillingPeriodChange?.(next);
    // Fresh mode: clear range + reset duration to 1 (like Clear dates).
    setDuration(1);
    setDurationText("1");
    durationSuggestedRef.current = false;
    setDraft(undefined);
    setOpen(false);
    onChange({ checkInDate: "", checkOutDate: "" });
  };

  const handleDurationCommit = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      setDurationText(String(duration));
      return;
    }
    const max = stayPeriodCountMax(period);
    const n = max != null ? Math.min(parsed, max) : parsed;
    setDuration(n);
    setDurationText(String(n));
    const start = checkInDate || draftFrom;
    if (!start) {
      return;
    }
    const nextOut = checkoutFromPeriodCount(period, start, n);
    if (checkInDate) {
      onChange({ checkInDate: start, checkOutDate: nextOut });
    }
    if (open) {
      setDraft({ from: ymdToDate(start), to: ymdToDate(nextOut) });
      durationSuggestedRef.current = true;
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const nextDraft = rangeFromYmd(checkInDate, checkOutDate);
      setDraft(nextDraft);
      durationSuggestedRef.current = false;
      const base = nextDraft?.from ?? ymdToDate(checkInDate) ?? new Date();
      setDisplayMonth(base);
      setMonthPickerYear(base.getFullYear());
      setYearPickerCenter(base.getFullYear());
    } else {
      setDraft(rangeFromYmd(checkInDate, checkOutDate));
      durationSuggestedRef.current = false;
    }
    setOpen(next);
  };

  const handleConfirm = () => {
    if (!canConfirm || !draft?.from || !draft.to) {
      return;
    }
    const from = dateToYmd(draft.from);
    const to = dateToYmd(draft.to);
    const count = periodCountFromRange(period, from, to);
    if (count != null) {
      setDuration(count);
      setDurationText(String(count));
    }
    durationSuggestedRef.current = false;
    onChange({ checkInDate: from, checkOutDate: to });
    setOpen(false);
  };

  const hasCommittedRange = Boolean(checkInDate || checkOutDate);
  const hasDraftRange = Boolean(draftFrom);

  const handleClear = () => {
    setDraft(undefined);
    durationSuggestedRef.current = false;
    onChange({ checkInDate: "", checkOutDate: "" });
  };

  const disabledMatcher: Matcher | Matcher[] = (date) => {
    if (!pickingCheckOut || !draftFrom) {
      return false;
    }
    return dateToYmd(date) <= draftFrom;
  };

  const handleSelectDaily = (range: DateRange | undefined) => {
    if (!range?.from) {
      setDraft(undefined);
      durationSuggestedRef.current = false;
      return;
    }

    const clickedYmd = dateToYmd(range.from);
    const toYmd = range.to ? dateToYmd(range.to) : "";
    const incomplete = !toYmd || toYmd === clickedYmd;

    if (incomplete) {
      applyPeriodClick(clickedYmd, { checkOccupied: true });
      return;
    }

    if (toYmd <= clickedYmd) {
      setDraft({ from: range.from, to: undefined });
      durationSuggestedRef.current = false;
      return;
    }

    durationSuggestedRef.current = false;
    setDraft(range);
    syncDurationFromRange(clickedYmd, toYmd);
  };

  const stickyDay = dayOfMonthFromYmd(checkInDate || draftFrom, todayYmd());

  const handlePickMonth = (year: number, month: number) => {
    applyPeriodClick(ymdFromYearMonthDay(year, month, stickyDay));
  };

  const handlePickYear = (year: number) => {
    const base = ymdToDate(checkInDate || draftFrom) ?? new Date();
    applyPeriodClick(
      ymdFromYearMonthDay(year, base.getMonth() + 1, stickyDay),
    );
  };

  const draftFromYm = draftFrom ? draftFrom.slice(0, 7) : "";
  const draftToYm = draftTo ? draftTo.slice(0, 7) : "";
  const draftFromYear = draftFrom ? Number(draftFrom.slice(0, 4)) : null;
  const draftToYear = draftTo ? Number(draftTo.slice(0, 4)) : null;

  const monthCellState = (year: number, month: number) => {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const isStart = Boolean(draftFromYm) && ym === draftFromYm;
    const isEnd = Boolean(draftToYm) && ym === draftToYm;
    const isMiddle =
      Boolean(draftFromYm) &&
      Boolean(draftToYm) &&
      ym > draftFromYm &&
      ym < draftToYm;
    return { isStart, isEnd, isMiddle };
  };

  const yearCellState = (year: number) => {
    const isStart = draftFromYear != null && year === draftFromYear;
    const isEnd = draftToYear != null && year === draftToYear;
    const isMiddle =
      draftFromYear != null &&
      draftToYear != null &&
      year > draftFromYear &&
      year < draftToYear;
    return { isStart, isEnd, isMiddle };
  };

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open]);

  const durationField = (
    <div className="flex min-w-[5.5rem] flex-col gap-1">
      <label
        htmlFor={`${id}-duration`}
        className="text-xs font-medium text-muted-foreground"
      >
        Duration
      </label>
      <div className="flex items-center gap-1.5">
        <Input
          id={`${id}-duration`}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          autoComplete="off"
          className="h-8 w-16 tabular-nums"
          value={durationText}
          onChange={(e) => {
            setDurationText(e.target.value);
          }}
          onBlur={() => {
            handleDurationCommit(durationText);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleDurationCommit(durationText);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <span className="text-xs text-muted-foreground">
          {durationUnitLabel(period, duration)}
        </span>
      </div>
    </div>
  );

  const triggerButton = (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {copy === "block" ? "Dates" : "Range"}
      </span>
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
    </div>
  );

  const periodCellClass = (state: {
    isStart: boolean;
    isEnd: boolean;
    isMiddle: boolean;
  }) =>
    cn(
      "h-10 w-full rounded-md text-sm font-normal tabular-nums transition-colors",
      "hover:bg-accent hover:text-accent-foreground",
      state.isMiddle && "rounded-none bg-primary/10 text-foreground",
      (state.isStart || state.isEnd) &&
        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
      state.isStart && state.isEnd && "rounded-md",
      state.isStart && !state.isEnd && "rounded-l-md rounded-r-none",
      state.isEnd && !state.isStart && "rounded-r-md rounded-l-none",
    );

  const monthGrid = (
    <div className="flex flex-col gap-3 p-3 sm:min-w-[22rem]">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Previous year"
          onClick={() => {
            setMonthPickerYear((y) => y - 1);
          }}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums">{monthPickerYear}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Next year"
          onClick={() => {
            setMonthPickerYear((y) => y + 1);
          }}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <div
        className="grid grid-cols-3 gap-0 sm:grid-cols-4"
        role="grid"
        aria-label="Select month range"
      >
        {MONTH_SHORT.map((label, idx) => {
          const month = idx + 1;
          const state = monthCellState(monthPickerYear, month);
          return (
            <button
              key={label}
              type="button"
              role="gridcell"
              aria-selected={state.isStart || state.isEnd || state.isMiddle}
              className={periodCellClass(state)}
              onClick={() => {
                handlePickMonth(monthPickerYear, month);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Same day-of-month ({stickyDay})
        {labels.sameDateHint}. Pick start month, then end — same as dates.
      </p>
    </div>
  );

  const yearList = useMemo(() => {
    const years: number[] = [];
    for (let y = yearPickerCenter - 4; y <= yearPickerCenter + 5; y += 1) {
      years.push(y);
    }
    return years;
  }, [yearPickerCenter]);

  const yearGrid = (
    <div className="flex flex-col gap-3 p-3 sm:min-w-[22rem]">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Earlier years"
          onClick={() => {
            setYearPickerCenter((y) => y - 10);
          }}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium text-muted-foreground">Years</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Later years"
          onClick={() => {
            setYearPickerCenter((y) => y + 10);
          }}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <div
        className="grid grid-cols-2 gap-0 sm:grid-cols-5"
        role="grid"
        aria-label="Select year range"
      >
        {yearList.map((year) => {
          const state = yearCellState(year);
          return (
            <button
              key={year}
              type="button"
              role="gridcell"
              aria-selected={state.isStart || state.isEnd || state.isMiddle}
              className={periodCellClass(state)}
              onClick={() => {
                handlePickYear(year);
              }}
            >
              {year}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Same month/day as start{labels.sameDateHint}. Pick start year, then
        end — same as dates.
      </p>
    </div>
  );

  const dailyCalendar = (
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
          onSelect={handleSelectDaily}
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
    </>
  );

  const panelBody = occupancyError ? (
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
      <div className="flex justify-center bg-background p-2 [--cell-size:--spacing(7)]">
        <div
          className={cn(
            "relative flex gap-4",
            monthCount === 1 ? "flex-col" : "flex-col md:flex-row",
          )}
        >
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
      {period === StayBillingPeriod.DAILY && dailyCalendar}
      {period === StayBillingPeriod.MONTHLY && monthGrid}
      {period === StayBillingPeriod.YEARLY && yearGrid}
      <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5">
        {unitId && period === StayBillingPeriod.DAILY ? (
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
          {!unitId && period === StayBillingPeriod.DAILY ? (
            labels.chooseUnit
          ) : draftOverlapsBusy ? (
            <>
              That range{" "}
              <span className="font-medium text-destructive">overlaps</span>{" "}
              {labels.busyNoun} — pick another.
            </>
          ) : draftComplete && draftPeriodCount != null ? (
            `${draftPeriodCount} ${durationUnitLabel(period, draftPeriodCount)}${labels.exclusive}`
          ) : draftComplete && draftPeriodCount == null ? (
            <span className="text-destructive">
              End must land on a valid {durationUnitLabel(period, 2)} boundary
            </span>
          ) : draftFrom ? (
            pickEndHint
          ) : (
            pickStartHint
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
    <div className="flex flex-col gap-2.5 text-foreground">
      {showPeriodToggle && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={period}
          onValueChange={(v) => {
            if (v) {
              handlePeriodChange(v);
            }
          }}
          className="w-full"
          aria-label="Stay billing period"
        >
          <ToggleGroupItem value={StayBillingPeriod.DAILY} className="flex-1">
            Daily
          </ToggleGroupItem>
          <ToggleGroupItem value={StayBillingPeriod.MONTHLY} className="flex-1">
            Monthly
          </ToggleGroupItem>
          <ToggleGroupItem value={StayBillingPeriod.YEARLY} className="flex-1">
            Yearly
          </ToggleGroupItem>
        </ToggleGroup>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {durationField}
        {triggerButton}
      </div>

      {open && (
        <div
          ref={panelRef}
          id={`${id}-panel`}
          role="region"
          aria-label={labels.panelLabel}
          className="overflow-hidden rounded-lg bg-popover text-foreground ring-1 ring-foreground/10"
        >
          {panelBody}
        </div>
      )}

      {committedCount > 0 && !open && checkInDate && checkOutDate && (
        <p className="text-xs text-muted-foreground">
          {committedCount} {durationUnitLabel(period, committedCount)}
          <span className="text-muted-foreground/80">{labels.exclusive}</span>
          {period !== StayBillingPeriod.DAILY
            ? ` · ${nightCount(checkInDate, checkOutDate)} nights on calendar`
            : null}
        </p>
      )}
    </div>
  );
}
