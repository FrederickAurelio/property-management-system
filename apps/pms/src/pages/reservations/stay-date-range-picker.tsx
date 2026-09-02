/* anchor: Linear-dense stay control, diverge: duration + Daily/Monthly/Yearly ToggleGroup */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import type { DateRange, DayButton, Matcher } from "react-day-picker";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  StayBillingPeriod,
  addDaysYmd,
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
import {
  calendarOpsProps,
  dateToYmd,
  ymdToDate,
} from "@/lib/ops-date";
import { cn } from "@/lib/utils";
import { nightCount } from "./reservation-format";

/**
 * Module-level DayButton — must keep a stable component identity.
 * An inline `components.DayButton` remounts every visible day cell on each
 * picker re-render (draft click, occupancy fetch), which is the main lag.
 */
function StayCalendarDayButton({
  className,
  modifiers,
  disabled,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  return (
    <CalendarDayButton
      {...props}
      modifiers={modifiers}
      disabled={
        Boolean(disabled) &&
        !modifiers.occupied &&
        !modifiers.inventoryHold &&
        !modifiers.turnaround &&
        !modifiers.openHoldBlocked
      }
      className={cn(
        className,
        modifiers.today &&
          !modifiers.occupied &&
          !modifiers.inventoryHold &&
          !modifiers.turnaround &&
          !modifiers.openHoldBlocked &&
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
        modifiers.inventoryHold &&
          !modifiers.occupied &&
          cn(
            "bg-inventory-hold! text-inventory-hold-foreground! opacity-100!",
            "font-medium shadow-none",
            "ring-1 ring-inventory-hold-foreground/25 ring-inset",
            "hover:brightness-[0.97]! dark:hover:brightness-110!",
          ),
        modifiers.openHoldBlocked &&
          !modifiers.occupied &&
          !modifiers.inventoryHold &&
          cn(
            "bg-stay-caution! text-stay-caution-foreground! opacity-100!",
            "font-medium shadow-none",
            "ring-1 ring-stay-caution-foreground/30 ring-inset",
            "hover:brightness-[0.97]! dark:hover:brightness-110!",
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
  );
}

const STAY_CALENDAR_COMPONENTS = {
  DayButton: StayCalendarDayButton,
};

/**
 * First busy night after check-in that is still a valid exclusive checkout
 * (path [checkIn, night) is free). Precomputed once per draft — avoids
 * day-walking inside every modifier call.
 */
function firstTurnaroundNight(
  checkInYmd: string,
  blockedNights: Set<string>,
  clipUntilExclusive: string,
): string | null {
  // Old rangeHasBlockedNight walked [checkIn, end) inclusive of check-in.
  // Busy check-in ⇒ no free path ⇒ no turnaround paint.
  if (blockedNights.has(checkInYmd)) {
    return null;
  }
  let cursor = addDaysYmd(checkInYmd, 1);
  while (cursor < clipUntilExclusive) {
    if (blockedNights.has(cursor)) {
      return cursor;
    }
    cursor = addDaysYmd(cursor, 1);
  }
  return null;
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

function yearMonthOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Add `n` calendar months to a YYYY-MM key. */
function addYearMonth(yearMonth: string, n: number): string {
  const [yRaw, mRaw] = yearMonth.split("-");
  const total = Number(yRaw) * 12 + (Number(mRaw) - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Split busy nights into contract occupied vs open-hold tail (cream).
 * Hold = `[contractCheckOutDate, inventoryEnd)` when contract end < inventory end.
 */
function expandOccupiedAndHoldNights(
  blocks: UnitOccupancyBlock[],
  clipUntilExclusive: string,
): { occupied: Set<string>; hold: Set<string> } {
  const occupied = new Set<string>();
  const hold = new Set<string>();
  for (const block of blocks) {
    const inventoryEnd =
      block.checkOutDate < clipUntilExclusive
        ? block.checkOutDate
        : clipUntilExclusive;
    const contractEnd =
      block.contractCheckOutDate && block.contractCheckOutDate < inventoryEnd
        ? block.contractCheckOutDate
        : null;

    if (contractEnd) {
      let cursor = block.checkInDate;
      while (cursor < contractEnd) {
        occupied.add(cursor);
        cursor = addDaysYmd(cursor, 1);
      }
      cursor = contractEnd;
      while (cursor < inventoryEnd) {
        // Prefer occupied if overlapping another stay's contract night.
        if (!occupied.has(cursor)) {
          hold.add(cursor);
        }
        cursor = addDaysYmd(cursor, 1);
      }
    } else {
      let cursor = block.checkInDate;
      while (cursor < inventoryEnd) {
        occupied.add(cursor);
        hold.delete(cursor);
        cursor = addDaysYmd(cursor, 1);
      }
    }
  }
  return { occupied, hold };
}

/** Half-open [a0,a1) ∩ [b0,b1) — date strings, lexicographic YYYY-MM-DD. */
function intervalsOverlap(
  a0: string,
  a1: string,
  b0: string,
  b1: string,
): boolean {
  return a0 < b1 && b0 < a1;
}

/** True if [from, to) overlaps any occupancy block (no day-walking). */
function rangeOverlapsOccupancy(
  from: string,
  to: string,
  blocks: readonly UnitOccupancyBlock[],
): boolean {
  if (from >= to || blocks.length === 0) {
    return false;
  }
  return blocks.some((b) =>
    intervalsOverlap(from, to, b.checkInDate, b.checkOutDate),
  );
}

function nightOccupied(
  ymd: string,
  blocks: readonly UnitOccupancyBlock[],
): boolean {
  return blocks.some((b) => b.checkInDate <= ymd && ymd < b.checkOutDate);
}

/**
 * Monthly/yearly FAR hold from `startYmd` conflicts iff start is before the
 * unit-wide MAX inventory end (`openHoldBlockedBefore`).
 */
function openHoldStartBlocked(
  startYmd: string,
  openHoldBlockedBefore: string | null | undefined,
): boolean {
  return Boolean(openHoldBlockedBefore && startYmd < openHoldBlockedBefore);
}

function durationUnitLabel(
  t: TFunction,
  period: StayBillingPeriodType,
  count: number,
): string {
  if (period === StayBillingPeriod.MONTHLY) {
    return t("reservations:format.units.month", { count });
  }
  if (period === StayBillingPeriod.YEARLY) {
    return t("reservations:format.units.year", { count });
  }
  return t("reservations:format.units.night", { count });
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
  /** Editing a calendar block — omit it from occupancy (API + extras). */
  excludeOccupancyId?: string;
  copy?: "stay" | "block";
  /** Fires when the inline calendar panel opens/closes (for parent form footer gating). */
  onPanelOpenChange?: (open: boolean) => void;
  /** Property IANA zone — ops today highlight + occupancy fallback. */
  propertyTimezone?: string;
  /** Property-local ops today YMD — parent should pass `opsTodayYmd(tz)`. */
  opsTodayYmd?: string;
};

type StayDatePickerLabels = {
  panelLabel: string;
  emptyTrigger: string;
  bookedNight: string;
  bookedNightHint: string;
  openHoldBlocked: string;
  openHoldBlockedHint: string;
  inventoryHold: string;
  inventoryHoldHint: string;
  turnaround: string;
  turnaroundHint: string;
  chooseUnit: string;
  pickStartDaily: string;
  pickEndDaily: string;
  pickStartAnchor: string;
  exclusive: string;
  busyNoun: string;
  clearDates: string;
};

function buildLabels(
  t: TFunction,
  copy: "stay" | "block",
): StayDatePickerLabels {
  const base = `reservations:stayDatePicker.${copy}` as const;
  return {
    panelLabel: t(`${base}.panelLabel`),
    emptyTrigger: t(`${base}.emptyTrigger`),
    bookedNight: t(`${base}.bookedNight`),
    bookedNightHint: t(`${base}.bookedNightHint`),
    openHoldBlocked: t(`${base}.openHoldBlocked`),
    openHoldBlockedHint: t(`${base}.openHoldBlockedHint`),
    inventoryHold: t(`${base}.inventoryHold`),
    inventoryHoldHint: t(`${base}.inventoryHoldHint`),
    turnaround: t(`${base}.turnaround`),
    turnaroundHint: t(`${base}.turnaroundHint`),
    chooseUnit: t(`${base}.chooseUnit`),
    pickStartDaily: t(`${base}.pickStartDaily`),
    pickEndDaily: t(`${base}.pickEndDaily`),
    pickStartAnchor: t(`${base}.pickStartAnchor`),
    exclusive: t(`${base}.exclusive`),
    busyNoun: t(`${base}.busyNoun`),
    clearDates: t(`${base}.clearDates`),
  };
}

function StayDateRangePickerComponent({
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
  onPanelOpenChange,
  propertyTimezone,
  opsTodayYmd: opsTodayYmdProp,
}: StayDateRangePickerProps) {
  const { t } = useTranslation(["reservations", "common"]);
  const labels = useMemo(() => buildLabels(t, copy), [t, copy]);
  const isMobile = useIsMobile();
  const period = billingPeriodProp ?? StayBillingPeriod.DAILY;
  const isAnchorMode = period !== StayBillingPeriod.DAILY;
  const calendarTodayProps = calendarOpsProps(propertyTimezone);
  const resolvedOpsTodayYmd = opsTodayYmdProp ?? dateToYmd(calendarTodayProps.today);
  const resolvedOpsTodayDate = useMemo(
    () => ymdToDate(resolvedOpsTodayYmd) ?? calendarTodayProps.today,
    [resolvedOpsTodayYmd, calendarTodayProps.today],
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() =>
    rangeFromYmd(checkInDate, checkOutDate),
  );
  const [displayMonth, setDisplayMonth] = useState<Date>(
    () => ymdToDate(checkInDate) ?? resolvedOpsTodayDate,
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
  const syncDurationFromRange = (from: string, to: string) => {
    const count = periodCountFromRange(period, from, to);
    if (count != null && count >= 1) {
      setDuration(count);
      setDurationText(String(count));
    }
  };

  /** Anchor (monthly/yearly): one month — single check-in pick. Daily desktop: two for range. */
  const monthCount = isAnchorMode ? 1 : isMobile ? 1 : 2;
  const visibleYearMonths = useMemo(() => {
    const months: string[] = [];
    for (let i = 0; i < monthCount; i += 1) {
      months.push(yearMonthOf(addMonths(displayMonth, i)));
    }
    return months;
  }, [displayMonth, monthCount]);

  /** One occupancy range for the visible picker window (+ spill). */
  const occupancyWindow = useMemo(() => {
    const first = visibleYearMonths[0];
    const last = visibleYearMonths[visibleYearMonths.length - 1];
    if (!first || !last) {
      return { from: resolvedOpsTodayYmd, to: addDaysYmd(resolvedOpsTodayYmd, 62) };
    }
    return {
      from: `${first}-01`,
      to: `${addYearMonth(last, 2)}-01`,
    };
  }, [visibleYearMonths, resolvedOpsTodayYmd]);

  const occupancyQuery = useQuery({
    queryKey: staffUnitOccupancyQueryKey(unitId ?? "", {
      from: occupancyWindow.from,
      to: occupancyWindow.to,
      ...(excludeReservationId ? { excludeReservationId } : {}),
      ...(excludeOccupancyId ? { excludeBlockId: excludeOccupancyId } : {}),
    }),
    queryFn: () =>
      getUnitMonthOccupancy(unitId!, {
        from: occupancyWindow.from,
        to: occupancyWindow.to,
        ...(excludeReservationId ? { excludeReservationId } : {}),
        ...(excludeOccupancyId ? { excludeBlockId: excludeOccupancyId } : {}),
      }),
    enabled: open && Boolean(unitId),
    // Default query staleTime (30s). Writes invalidate occupancy via
    // syncReservationCaches — no need to refetch on every panel open.
  });

  const openHoldClipYmd = occupancyWindow.to;

  const occupancyBlocks = useMemo(() => {
    const omitSelf = (b: UnitOccupancyBlock) =>
      !excludeOccupancyId || b.reservationId !== excludeOccupancyId;
    const apiBlocks = (occupancyQuery.data?.blocks ?? []).filter(omitSelf);
    const extras = (extraOccupancyBlocks ?? []).filter(omitSelf);
    return [...apiBlocks, ...extras];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    occupancyQuery.data?.blocks,
    occupancyQuery.dataUpdatedAt,
    excludeOccupancyId,
    extraOccupancyBlocks,
  ]);

  /** Unit-wide FAR horizon — null when unit has no occupying inventory. */
  const openHoldBlockedBefore = useMemo(() => {
    let horizon = occupancyQuery.data?.openHoldBlockedBefore ?? null;
    // FE extras (e.g. calendar-sourced) are not in the API aggregate.
    for (const block of extraOccupancyBlocks ?? []) {
      if (excludeOccupancyId && block.reservationId === excludeOccupancyId) {
        continue;
      }
      if (!horizon || block.checkOutDate > horizon) {
        horizon = block.checkOutDate;
      }
    }
    return horizon;
  }, [
    occupancyQuery.data?.openHoldBlockedBefore,
    extraOccupancyBlocks,
    excludeOccupancyId,
  ]);

  const { occupiedNights, holdNights, blockedNights } = useMemo(() => {
    const { occupied, hold } = expandOccupiedAndHoldNights(
      occupancyBlocks,
      openHoldClipYmd,
    );
    return {
      occupiedNights: occupied,
      holdNights: hold,
      blockedNights: new Set<string>([...occupied, ...hold]),
    };
  }, [occupancyBlocks, openHoldClipYmd]);

  const occupancyPending =
    Boolean(unitId) &&
    open &&
    (occupancyQuery.isPending ||
      (!occupancyQuery.data && occupancyQuery.isFetching));

  const occupancyError = Boolean(unitId) && open && occupancyQuery.isError;

  const occupancyRetrying = occupancyError && occupancyQuery.isFetching;

  const occupancyReady = !unitId || occupancyQuery.data != null;

  const draftFrom = draft?.from ? dateToYmd(draft.from) : "";
  const draftTo = draft?.to ? dateToYmd(draft.to) : "";
  const draftComplete = Boolean(draftFrom && draftTo) && draftFrom !== draftTo;
  const draftPeriodCount = draftComplete
    ? periodCountFromRange(period, draftFrom, draftTo)
    : null;
  /**
   * Daily: conflict if contract nights hit a busy interval.
   * Monthly/yearly: FAR hold from check-in — use unit-wide horizon (not window clip).
   */
  const draftOverlapsBusy =
    draftComplete &&
    Boolean(unitId) &&
    occupancyReady &&
    Boolean(draftFrom) &&
    (period === StayBillingPeriod.DAILY
      ? rangeOverlapsOccupancy(draftFrom, draftTo, occupancyBlocks)
      : openHoldStartBlocked(draftFrom, openHoldBlockedBefore));
  const canConfirm =
    draftComplete &&
    draftPeriodCount != null &&
    draftPeriodCount >= 1 &&
    !draftOverlapsBusy &&
    !occupancyError;

  const pickingCheckOut =
    !isAnchorMode && Boolean(draftFrom) && (!draftTo || draftTo === draftFrom);

  const pickStartHint = isAnchorMode
    ? labels.pickStartAnchor
    : labels.pickStartDaily;

  /**
   * Daily: first click sets check-in only — check-out is a separate click.
   * Monthly/yearly: check-in + check-out from duration (anchor mode).
   */
  const applyPeriodClick = (
    clickedYmd: string,
    opts: { checkOccupied?: boolean } = {},
  ) => {
    if (
      opts.checkOccupied &&
      unitId &&
      (nightOccupied(clickedYmd, occupancyBlocks) ||
        (isAnchorMode &&
          openHoldStartBlocked(clickedYmd, openHoldBlockedBefore)))
    ) {
      return;
    }

    if (!isAnchorMode) {
      setDraft({ from: ymdToDate(clickedYmd), to: undefined });
      return;
    }

    if (duration >= 1) {
      const autoOut = checkoutFromPeriodCount(period, clickedYmd, duration);
      if (
        opts.checkOccupied &&
        unitId &&
        openHoldStartBlocked(clickedYmd, openHoldBlockedBefore)
      ) {
        setDraft({ from: ymdToDate(clickedYmd), to: undefined });
        return;
      }
      setDraft({
        from: ymdToDate(clickedYmd),
        to: ymdToDate(autoOut),
      });
      return;
    }

    setDraft({ from: ymdToDate(clickedYmd), to: undefined });
  };

  const closePanel = () => {
    setDraft(rangeFromYmd(checkInDate, checkOutDate));
    setOpen(false);
    onPanelOpenChange?.(false);
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
    setDuration(1);
    setDurationText("1");
    setDraft(undefined);
    onChange({ checkInDate: "", checkOutDate: "" });
    setOpen(false);
    onPanelOpenChange?.(false);
  };

  const applyDurationInput = (raw: string) => {
    setDurationText(raw);

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      return;
    }

    const max = stayPeriodCountMax(period);
    const n = Math.min(parsed, max);
    if (String(n) !== raw) {
      setDurationText(String(n));
    }
    if (n === duration) {
      return;
    }
    setDuration(n);

    const start = draftFrom || checkInDate;
    if (!start) {
      return;
    }
    const nextOut = checkoutFromPeriodCount(period, start, n);
    if (checkInDate) {
      onChange({ checkInDate: start, checkOutDate: nextOut });
    }
    if (open) {
      setDraft({ from: ymdToDate(start), to: ymdToDate(nextOut) });
    }
  };

  const normalizeDurationInput = () => {
    const parsed = Number(durationText);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      setDurationText(String(duration));
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const nextDraft = rangeFromYmd(checkInDate, checkOutDate);
      setDraft(nextDraft);
      const base =
        nextDraft?.from ?? ymdToDate(checkInDate) ?? resolvedOpsTodayDate;
      setDisplayMonth(base);
      setOpen(true);
      onPanelOpenChange?.(true);
      return;
    }
    closePanel();
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
    onChange({ checkInDate: from, checkOutDate: to });
    setOpen(false);
    onPanelOpenChange?.(false);
  };

  const hasCommittedRange = Boolean(checkInDate || checkOutDate);
  const hasDraftRange = Boolean(draftFrom);

  const handleClear = () => {
    setDuration(1);
    setDurationText("1");
    setDraft(undefined);
    onChange({ checkInDate: "", checkOutDate: "" });
  };

  const disabledMatcher: Matcher = (date) => {
    if (isAnchorMode || !pickingCheckOut || !draftFrom) {
      return false;
    }
    return dateToYmd(date) <= draftFrom;
  };

  const handleSelectAnchor = (date: Date | undefined) => {
    if (!date) {
      setDraft(undefined);
      return;
    }
    applyPeriodClick(dateToYmd(date), { checkOccupied: true });
  };

  const handleSelectDailyRange = (range: DateRange | undefined) => {
    if (!range?.from) {
      setDraft(undefined);
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
      return;
    }

    setDraft(range);
    syncDurationFromRange(clickedYmd, toYmd);
  };

  const showInventoryHoldLegend = Boolean(unitId) && holdNights.size > 0;

  /** One night max — turnaround exclusive checkout while picking daily end. */
  const turnaroundNight =
    !isAnchorMode && pickingCheckOut && draftFrom && unitId
      ? firstTurnaroundNight(draftFrom, blockedNights, openHoldClipYmd)
      : null;

  // Stable DayButton identity (module-level) is the hot path. Modifier fns are
  // cheap vs remounting cells; avoid useMemo here — React Compiler + Date-derived
  // draftFrom strings trip preserve-manual-memoization.
  const calendarModifiers = {
    occupied: (date: Date) => {
      if (!unitId) {
        return false;
      }
      const ymd = dateToYmd(date);
      if (!occupiedNights.has(ymd)) {
        return false;
      }
      // Turnaround night paints as turnaround, not occupied.
      if (turnaroundNight != null && ymd === turnaroundNight) {
        return false;
      }
      return true;
    },
    inventoryHold: (date: Date) => {
      if (!unitId) {
        return false;
      }
      const ymd = dateToYmd(date);
      if (!holdNights.has(ymd) || occupiedNights.has(ymd)) {
        return false;
      }
      if (turnaroundNight != null && ymd === turnaroundNight) {
        return false;
      }
      return true;
    },
    openHoldBlocked: (date: Date) => {
      if (!isAnchorMode || !unitId) {
        return false;
      }
      const ymd = dateToYmd(date);
      return (
        openHoldStartBlocked(ymd, openHoldBlockedBefore) &&
        !occupiedNights.has(ymd) &&
        !holdNights.has(ymd)
      );
    },
    turnaround: (date: Date) => {
      if (turnaroundNight == null) {
        return false;
      }
      return dateToYmd(date) === turnaroundNight;
    },
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
        {t("reservations:stayDatePicker.durationLabel")}
      </label>
      <div className="flex items-center gap-1.5">
        <Input
          id={`${id}-duration`}
          type="number"
          min={1}
          max={stayPeriodCountMax(period)}
          step={1}
          inputMode="numeric"
          autoComplete="off"
          className="h-8 w-16 tabular-nums"
          value={durationText}
          onChange={(e) => {
            applyDurationInput(e.target.value);
          }}
          onBlur={normalizeDurationInput}
        />
        <span className="text-xs text-muted-foreground">
          {durationUnitLabel(t, period, duration)}
        </span>
      </div>
    </div>
  );

  const triggerButton = (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {copy === "block"
          ? t("reservations:stayDatePicker.triggerLabelDates")
          : t("reservations:stayDatePicker.triggerLabelRange")}
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
              onPanelOpenChange?.(false);
            }}
          >
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );

  const stayCalendar = (
    <div className="flex justify-center">
      {isAnchorMode ? (
        <Calendar
          mode="single"
          numberOfMonths={monthCount}
          month={displayMonth}
          onMonthChange={setDisplayMonth}
          selected={draft?.from}
          onSelect={handleSelectAnchor}
          timeZone={calendarTodayProps.timeZone}
          today={calendarTodayProps.today}
          modifiers={calendarModifiers}
          components={STAY_CALENDAR_COMPONENTS}
        />
      ) : (
        <Calendar
          mode="range"
          min={1}
          resetOnSelect
          numberOfMonths={monthCount}
          month={displayMonth}
          onMonthChange={setDisplayMonth}
          selected={draft}
          onSelect={handleSelectDailyRange}
          timeZone={calendarTodayProps.timeZone}
          today={calendarTodayProps.today}
          disabled={disabledMatcher}
          modifiers={calendarModifiers}
          components={STAY_CALENDAR_COMPONENTS}
        />
      )}
    </div>
  );

  const panelFooterHint = () => {
    if (!unitId) {
      return labels.chooseUnit;
    }
    if (draftOverlapsBusy) {
      return t("reservations:stayDatePicker.overlapsBusy", {
        busyNoun: labels.busyNoun,
      });
    }
    if (draftComplete && draftPeriodCount != null && isAnchorMode) {
      return t("reservations:stayDatePicker.anchorSelectedSummary", {
        count: draftPeriodCount,
        unit: durationUnitLabel(t, period, draftPeriodCount),
        from: format(ymdToDate(draftFrom)!, "LLL d, y"),
        to: format(ymdToDate(draftTo)!, "LLL d, y"),
        nights: nightCount(draftFrom, draftTo),
        exclusive: labels.exclusive,
      });
    }
    if (draftComplete && draftPeriodCount != null) {
      return t("reservations:stayDatePicker.committedSummary", {
        count: draftPeriodCount,
        unit: durationUnitLabel(t, period, draftPeriodCount),
        exclusive: labels.exclusive,
      });
    }
    if (draftComplete && draftPeriodCount == null) {
      return (
        <span className="text-destructive">
          {t("reservations:stayDatePicker.invalidBoundary", {
            unit: durationUnitLabel(t, period, 2),
          })}
        </span>
      );
    }
    if (pickingCheckOut && draftFrom) {
      return t("reservations:stayDatePicker.pickEndWithCheckIn", {
        date: format(ymdToDate(draftFrom)!, "LLL d, y"),
      });
    }
    return pickStartHint;
  };

  const panelBody = occupancyError ? (
    <div className="w-full p-3 sm:w-[22rem]">
      <QueryErrorPanel
        message={t("reservations:stayDatePicker.loadBookedNightsError")}
        onRetry={() => {
          void occupancyQuery.refetch();
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
          {t("reservations:stayDatePicker.cancel")}
        </Button>
      </div>
    </div>
  ) : occupancyPending ? (
    <div
      aria-busy
      aria-label={t("reservations:stayDatePicker.loadingBookedNightsAria")}
    >
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
            {t("reservations:stayDatePicker.cancel")}
          </Button>
          <Button type="button" size="sm" disabled>
            {t("reservations:stayDatePicker.confirmDates")}
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <>
      {stayCalendar}
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
            {showInventoryHoldLegend ? (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex size-3.5 shrink-0 rounded-sm bg-inventory-hold ring-1 ring-inventory-hold-foreground/25"
                  aria-hidden
                />
                <span className="text-muted-foreground">
                  <span className="font-medium text-inventory-hold-foreground">
                    {labels.inventoryHold}
                  </span>
                  {labels.inventoryHoldHint}
                </span>
              </div>
            ) : null}
            {isAnchorMode && openHoldBlockedBefore ? (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex size-3.5 shrink-0 rounded-sm bg-stay-caution ring-1 ring-stay-caution-foreground/30"
                  aria-hidden
                />
                <span className="text-muted-foreground">
                  <span className="font-medium text-stay-caution-foreground">
                    {labels.openHoldBlocked}
                  </span>
                  {labels.openHoldBlockedHint}
                </span>
              </div>
            ) : null}
            {!isAnchorMode && draftFrom && (
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
        <p className="text-xs text-muted-foreground">{panelFooterHint()}</p>
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
              {t("reservations:stayDatePicker.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {t("reservations:stayDatePicker.confirmDates")}
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
          aria-label={t("reservations:stayDatePicker.billingPeriodAria")}
        >
          <ToggleGroupItem value={StayBillingPeriod.DAILY} className="flex-1">
            {t("reservations:stayDatePicker.periodToggle.daily")}
          </ToggleGroupItem>
          <ToggleGroupItem value={StayBillingPeriod.MONTHLY} className="flex-1">
            {t("reservations:stayDatePicker.periodToggle.monthly")}
          </ToggleGroupItem>
          <ToggleGroupItem value={StayBillingPeriod.YEARLY} className="flex-1">
            {t("reservations:stayDatePicker.periodToggle.yearly")}
          </ToggleGroupItem>
        </ToggleGroup>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
          {t("reservations:stayDatePicker.committedSummary", {
            count: committedCount,
            unit: durationUnitLabel(t, period, committedCount),
            exclusive: labels.exclusive,
          })}
          {isAnchorMode &&
            t("reservations:stayDatePicker.committedNightsOnCalendar", {
              count: nightCount(checkInDate, checkOutDate),
            })}
        </p>
      )}
    </div>
  );
}

export const StayDateRangePicker = memo(StayDateRangePickerComponent);
