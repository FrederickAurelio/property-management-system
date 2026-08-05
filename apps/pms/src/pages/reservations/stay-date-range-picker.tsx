/* anchor: Linear-dense stay control, diverge: duration + Daily/Monthly/Yearly ToggleGroup */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from "lucide-react";
import type { DateRange, Matcher } from "react-day-picker";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  StayBillingPeriod,
  STAY_YEAR_PICKER_AFTER,
  STAY_YEAR_PICKER_BEFORE,
  UNIT_OCCUPANCY_RANGE_MAX_YEARS,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function dayOfMonthFromYmd(ymd: string, fallbackDay = 1): number {
  const parts = ymd.split("-").map(Number);
  return parts[2] && parts[2] >= 1 && parts[2] <= 31 ? parts[2] : fallbackDay;
}

function monthFromYmd(ymd: string, fallbackMonth: number): number {
  const parts = ymd.split("-").map(Number);
  return parts[1] && parts[1] >= 1 && parts[1] <= 12 ? parts[1] : fallbackMonth;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function ymdFromYearMonthDay(year: number, month: number, day: number): string {
  const d = Math.min(day, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

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
      block.contractCheckOutDate &&
      block.contractCheckOutDate < inventoryEnd
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

/** Contract / hard-busy span: through contract checkout, or full block if no split. */
function rangeOverlapsContract(
  from: string,
  to: string,
  blocks: readonly UnitOccupancyBlock[],
): boolean {
  if (from >= to || blocks.length === 0) {
    return false;
  }
  return blocks.some((b) => {
    const contractEnd =
      b.contractCheckOutDate && b.contractCheckOutDate < b.checkOutDate
        ? b.contractCheckOutDate
        : b.checkOutDate;
    return intervalsOverlap(from, to, b.checkInDate, contractEnd);
  });
}

/** Open-hold FAR tail only: `[contractCheckOut, inventoryEnd)`. */
function rangeOverlapsHoldTail(
  from: string,
  to: string,
  blocks: readonly UnitOccupancyBlock[],
): boolean {
  if (from >= to || blocks.length === 0) {
    return false;
  }
  return blocks.some((b) => {
    if (!b.contractCheckOutDate || !(b.contractCheckOutDate < b.checkOutDate)) {
      return false;
    }
    return intervalsOverlap(
      from,
      to,
      b.contractCheckOutDate,
      b.checkOutDate,
    );
  });
}

function hasOpenHoldTail(
  blocks: readonly UnitOccupancyBlock[],
): boolean {
  return blocks.some(
    (b) =>
      Boolean(b.contractCheckOutDate) &&
      b.contractCheckOutDate! < b.checkOutDate,
  );
}

function nightOccupied(
  ymd: string,
  blocks: readonly UnitOccupancyBlock[],
): boolean {
  return blocks.some(
    (b) => b.checkInDate <= ymd && ymd < b.checkOutDate,
  );
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

/** Year grid: center± span must match occupancy fetch + UNIT_OCCUPANCY_RANGE_MAX_YEARS. */
const YEAR_PICKER_BEFORE = STAY_YEAR_PICKER_BEFORE;
const YEAR_PICKER_AFTER = STAY_YEAR_PICKER_AFTER;

/** Add `n` calendar months to a YYYY-MM key. */
function addYearMonth(yearMonth: string, n: number): string {
  const [yRaw, mRaw] = yearMonth.split("-");
  const total = Number(yRaw) * 12 + (Number(mRaw) - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
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
  excludeOccupancyId?: string;
  copy?: "stay" | "block";
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
  pickStartMonthly: string;
  pickEndMonthly: string;
  pickStartYearly: string;
  pickEndYearly: string;
  exclusive: string;
  busyNoun: string;
  clearDates: string;
  sameDateHint: string;
};

function buildLabels(t: TFunction, copy: "stay" | "block"): StayDatePickerLabels {
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
    pickStartMonthly: t(`${base}.pickStartMonthly`),
    pickEndMonthly: t(`${base}.pickEndMonthly`),
    pickStartYearly: t(`${base}.pickStartYearly`),
    pickEndYearly: t(`${base}.pickEndYearly`),
    exclusive: t(`${base}.exclusive`),
    busyNoun: t(`${base}.busyNoun`),
    clearDates: t(`${base}.clearDates`),
    sameDateHint: t(`${base}.sameDateHint`),
  };
}

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
  const { t } = useTranslation(["reservations", "common"]);
  const labels = useMemo(() => buildLabels(t, copy), [t, copy]);
  const isMobile = useIsMobile();
  const period = billingPeriodProp ?? StayBillingPeriod.DAILY;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() =>
    rangeFromYmd(checkInDate, checkOutDate),
  );
  const [displayMonth, setDisplayMonth] = useState<Date>(
    () => ymdToDate(checkInDate) ?? new Date(),
  );
  const [monthPickerYear, setMonthPickerYear] = useState(() =>
    (ymdToDate(checkInDate) ?? new Date()).getFullYear(),
  );
  const [yearPickerCenter, setYearPickerCenter] = useState(() =>
    (ymdToDate(checkInDate) ?? new Date()).getFullYear(),
  );
  /** Explicit calendar day for monthly/yearly (not inferred from “today”). */
  const [periodStartDay, setPeriodStartDay] = useState(() =>
    checkInDate ? dayOfMonthFromYmd(checkInDate) : 1,
  );
  /** Explicit calendar month for yearly stays. */
  const [periodStartMonth, setPeriodStartMonth] = useState(() =>
    checkInDate
      ? monthFromYmd(checkInDate, new Date().getMonth() + 1)
      : new Date().getMonth() + 1,
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
    if (checkInDate) {
      setPeriodStartDay(dayOfMonthFromYmd(checkInDate));
      setPeriodStartMonth(monthFromYmd(checkInDate, 1));
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

  /** Rebuild start/end from an explicit day (+ month for yearly), keeping period count. */
  const applyPeriodAnchor = (next: {
    day: number;
    month?: number;
    commit?: boolean;
  }) => {
    const day = Math.min(31, Math.max(1, next.day));
    const month = next.month ?? periodStartMonth;
    setPeriodStartDay(day);
    if (next.month != null) {
      setPeriodStartMonth(month);
    }

    const startSource = draftFrom || checkInDate;
    if (!startSource) {
      return;
    }
    const [y, m] = startSource.split("-").map(Number);
    if (!y || !m) {
      return;
    }

    const newFrom =
      period === StayBillingPeriod.YEARLY
        ? ymdFromYearMonthDay(y, month, day)
        : ymdFromYearMonthDay(y, m, day);

    const rangeCount =
      draftFrom && draftTo
        ? periodCountFromRange(period, draftFrom, draftTo)
        : null;
    const count =
      rangeCount != null && rangeCount >= 1
        ? rangeCount
        : duration >= 1
          ? duration
          : 1;
    const newTo = checkoutFromPeriodCount(period, newFrom, Math.max(1, count));

    if (open) {
      setDraft({ from: ymdToDate(newFrom), to: ymdToDate(newTo) });
      durationSuggestedRef.current = true;
    }
    if (next.commit !== false && checkInDate) {
      onChange({ checkInDate: newFrom, checkOutDate: newTo });
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

  /**
   * One occupancy range for the visible picker window (+ spill).
   * Avoids N parallel month requests for monthly/yearly UIs.
   */
  const occupancyWindow = useMemo(() => {
    if (period === StayBillingPeriod.MONTHLY) {
      return {
        from: `${monthPickerYear}-01-01`,
        // Through Jan next year so year-spill month cells stay blocked.
        to: `${monthPickerYear + 1}-02-01`,
      };
    }
    if (period === StayBillingPeriod.YEARLY) {
      // Must cover every year shown in the grid (STAY_YEAR_PICKER_*).
      return {
        from: `${yearPickerCenter - YEAR_PICKER_BEFORE}-01-01`,
        to: `${yearPickerCenter + YEAR_PICKER_AFTER + 1}-01-01`,
      };
    }
    const first = visibleYearMonths[0];
    const last = visibleYearMonths[visibleYearMonths.length - 1];
    if (!first || !last) {
      const today = todayYmd();
      return { from: today, to: addDaysYmd(today, 62) };
    }
    // Visible months + one spill month (next-month days on last grid).
    return {
      from: `${first}-01`,
      to: `${addYearMonth(last, 2)}-01`,
    };
  }, [
    period,
    visibleYearMonths,
    monthPickerYear,
    yearPickerCenter,
  ]);

  const occupancyQuery = useQuery({
    queryKey: staffUnitOccupancyQueryKey(unitId ?? "", {
      from: occupancyWindow.from,
      to: occupancyWindow.to,
      ...(excludeReservationId ? { excludeReservationId } : {}),
    }),
    queryFn: () =>
      getUnitMonthOccupancy(unitId!, {
        from: occupancyWindow.from,
        to: occupancyWindow.to,
        ...(excludeReservationId ? { excludeReservationId } : {}),
      }),
    enabled: open && Boolean(unitId),
    staleTime: 0,
  });

  const openHoldClipYmd = occupancyWindow.to;

  const occupancyBlocks = useMemo(() => {
    const apiBlocks = occupancyQuery.data?.blocks ?? [];
    const extras = (extraOccupancyBlocks ?? []).filter(
      (b) => !excludeOccupancyId || b.reservationId !== excludeOccupancyId,
    );
    return [...apiBlocks, ...extras];
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
    occupancyQuery.dataUpdatedAt,
    extraOccupancyBlocks,
    excludeOccupancyId,
  ]);

  /** Day grid only — monthly/yearly use interval checks on blocks (no day-walk). */
  const { occupiedNights, holdNights, blockedNights } = useMemo(() => {
    if (period !== StayBillingPeriod.DAILY) {
      const empty = new Set<string>();
      return {
        occupiedNights: empty,
        holdNights: empty,
        blockedNights: empty,
      };
    }
    const { occupied, hold } = expandOccupiedAndHoldNights(
      occupancyBlocks,
      openHoldClipYmd,
    );
    return {
      occupiedNights: occupied,
      holdNights: hold,
      blockedNights: new Set<string>([...occupied, ...hold]),
    };
  }, [period, occupancyBlocks, openHoldClipYmd]);

  const occupancyPending =
    Boolean(unitId) &&
    open &&
    (occupancyQuery.isPending ||
      (!occupancyQuery.data && occupancyQuery.isFetching));

  const occupancyError =
    Boolean(unitId) && open && occupancyQuery.isError;

  const occupancyRetrying = occupancyError && occupancyQuery.isFetching;

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
    Boolean(draftFrom) &&
    (period === StayBillingPeriod.DAILY
      ? rangeOverlapsOccupancy(draftFrom, draftTo, occupancyBlocks)
      : openHoldStartBlocked(draftFrom, openHoldBlockedBefore));
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
    const openHold = period !== StayBillingPeriod.DAILY;

    if (
      durationSuggestedRef.current &&
      prevComplete &&
      prevFrom &&
      clickedYmd > prevFrom
    ) {
      if (
        opts.checkOccupied &&
        unitId &&
        (openHold
          ? openHoldStartBlocked(prevFrom, openHoldBlockedBefore)
          : rangeOverlapsOccupancy(prevFrom, clickedYmd, occupancyBlocks))
      ) {
        return;
      }
      setDraft({
        from: ymdToDate(prevFrom),
        to: ymdToDate(clickedYmd),
      });
      durationSuggestedRef.current = false;
      syncDurationFromRange(prevFrom, clickedYmd);
      return;
    }

    if (
      opts.checkOccupied &&
      unitId &&
      (nightOccupied(clickedYmd, occupancyBlocks) ||
        (openHold &&
          openHoldStartBlocked(clickedYmd, openHoldBlockedBefore)))
    ) {
      return;
    }

    if (duration >= 1) {
      const autoOut = checkoutFromPeriodCount(period, clickedYmd, duration);
      if (
        opts.checkOccupied &&
        unitId &&
        (openHold
          ? openHoldStartBlocked(clickedYmd, openHoldBlockedBefore)
          : rangeOverlapsOccupancy(clickedYmd, autoOut, occupancyBlocks))
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
    // Fresh mode: clear range + reset duration / start day (like Clear dates).
    setDuration(1);
    setDurationText("1");
    setPeriodStartDay(1);
    setPeriodStartMonth(new Date().getMonth() + 1);
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
      if (checkInDate) {
        setPeriodStartDay(dayOfMonthFromYmd(checkInDate));
        setPeriodStartMonth(monthFromYmd(checkInDate, base.getMonth() + 1));
      }
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
    setDuration(1);
    setDurationText("1");
    setPeriodStartDay(1);
    setPeriodStartMonth(new Date().getMonth() + 1);
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

  const handlePickMonth = (year: number, month: number) => {
    applyPeriodClick(ymdFromYearMonthDay(year, month, periodStartDay), {
      checkOccupied: true,
    });
  };

  const handlePickYear = (year: number) => {
    applyPeriodClick(
      ymdFromYearMonthDay(year, periodStartMonth, periodStartDay),
      { checkOccupied: true },
    );
  };

  const draftFromYm = draftFrom ? draftFrom.slice(0, 7) : "";
  const draftToYm = draftTo ? draftTo.slice(0, 7) : "";
  const draftFromYear = draftFrom ? Number(draftFrom.slice(0, 4)) : null;
  const draftToYear = draftTo ? Number(draftTo.slice(0, 4)) : null;
  const todayParts = todayYmd();
  const todayYear = Number(todayParts.slice(0, 4));
  const todayYm = todayParts.slice(0, 7);

  /**
   * Paint month/year:
   * - red = contract (or non-split) busy in this cell
   * - cream inventory hold = FAR tail only in this cell
   * - cream open-hold-blocked = empty cell but can’t start FAR hold here
   */
  const monthCellState = (year: number, month: number) => {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const monthStart = `${ym}-01`;
    const monthEnd = `${addYearMonth(ym, 1)}-01`;
    const startYmd = ymdFromYearMonthDay(year, month, periodStartDay);
    const isStart = Boolean(draftFromYm) && ym === draftFromYm;
    const isEnd = Boolean(draftToYm) && ym === draftToYm;
    const isMiddle =
      Boolean(draftFromYm) &&
      Boolean(draftToYm) &&
      ym > draftFromYm &&
      ym < draftToYm;
    const hasContract =
      Boolean(unitId) &&
      rangeOverlapsContract(monthStart, monthEnd, occupancyBlocks);
    const hasHoldTail =
      Boolean(unitId) &&
      rangeOverlapsHoldTail(monthStart, monthEnd, occupancyBlocks);
    const holdBlocked =
      Boolean(unitId) &&
      openHoldStartBlocked(startYmd, openHoldBlockedBefore);
    return {
      isStart,
      isEnd,
      isMiddle,
      isToday: ym === todayYm,
      isPast: ym < todayYm,
      isOccupied: hasContract,
      isInventoryHold: hasHoldTail && !hasContract,
      isOpenHoldBlocked: holdBlocked && !hasContract && !hasHoldTail,
      isStartBlocked:
        Boolean(unitId) &&
        (nightOccupied(startYmd, occupancyBlocks) || holdBlocked),
    };
  };

  const yearCellState = (year: number) => {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;
    const startYmd = ymdFromYearMonthDay(
      year,
      periodStartMonth,
      periodStartDay,
    );
    const isStart = draftFromYear != null && year === draftFromYear;
    const isEnd = draftToYear != null && year === draftToYear;
    const isMiddle =
      draftFromYear != null &&
      draftToYear != null &&
      year > draftFromYear &&
      year < draftToYear;
    const hasContract =
      Boolean(unitId) &&
      rangeOverlapsContract(yearStart, yearEnd, occupancyBlocks);
    const hasHoldTail =
      Boolean(unitId) &&
      rangeOverlapsHoldTail(yearStart, yearEnd, occupancyBlocks);
    const holdBlocked =
      Boolean(unitId) &&
      openHoldStartBlocked(startYmd, openHoldBlockedBefore);
    return {
      isStart,
      isEnd,
      isMiddle,
      isToday: year === todayYear,
      isPast: year < todayYear,
      isOccupied: hasContract,
      isInventoryHold: hasHoldTail && !hasContract,
      isOpenHoldBlocked: holdBlocked && !hasContract && !hasHoldTail,
      isStartBlocked:
        Boolean(unitId) &&
        (nightOccupied(startYmd, occupancyBlocks) || holdBlocked),
    };
  };

  const showInventoryHoldLegend =
    Boolean(unitId) &&
    (period === StayBillingPeriod.DAILY
      ? holdNights.size > 0
      : hasOpenHoldTail(occupancyBlocks));

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
          {durationUnitLabel(t, period, duration)}
        </span>
      </div>
    </div>
  );

  const periodAnchorFields =
    period === StayBillingPeriod.MONTHLY ||
    period === StayBillingPeriod.YEARLY ? (
      <div className="flex flex-wrap items-end gap-3">
        {period === StayBillingPeriod.YEARLY && (
          <div className="flex min-w-[7rem] flex-col gap-1">
            <label
              htmlFor={`${id}-start-month`}
              className="text-xs font-medium text-muted-foreground"
            >
              {t("reservations:stayDatePicker.startMonthLabel")}
            </label>
            <Select
              value={String(periodStartMonth)}
              onValueChange={(v) => {
                const month = Number(v);
                if (!Number.isInteger(month) || month < 1 || month > 12) {
                  return;
                }
                applyPeriodAnchor({ day: periodStartDay, month });
              }}
            >
              <SelectTrigger
                id={`${id}-start-month`}
                size="sm"
                className="w-28"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MONTH_SHORT.map((label, idx) => (
                    <SelectItem key={label} value={String(idx + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex min-w-[5.5rem] flex-col gap-1">
          <label
            htmlFor={`${id}-start-day`}
            className="text-xs font-medium text-muted-foreground"
          >
            {t("reservations:stayDatePicker.startDayLabel")}
          </label>
          <Select
            value={String(periodStartDay)}
            onValueChange={(v) => {
              const day = Number(v);
              if (!Number.isInteger(day) || day < 1 || day > 31) {
                return;
              }
              applyPeriodAnchor({
                day,
                ...(period === StayBillingPeriod.YEARLY
                  ? { month: periodStartMonth }
                  : {}),
              });
            }}
          >
            <SelectTrigger id={`${id}-start-day`} size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {DAY_OPTIONS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    ) : null;

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
    isToday: boolean;
    isPast: boolean;
    isOccupied?: boolean;
    isInventoryHold?: boolean;
    isOpenHoldBlocked?: boolean;
  }) => {
    const inRange = state.isStart || state.isEnd || state.isMiddle;
    return cn(
      "h-10 w-full rounded-md text-sm font-normal tabular-nums transition-colors",
      "hover:bg-accent hover:text-accent-foreground",
      state.isOccupied &&
        !inRange &&
        "bg-destructive/25 text-destructive ring-1 ring-destructive/40 hover:bg-destructive/30 hover:text-destructive",
      state.isInventoryHold &&
        !inRange &&
        !state.isOccupied &&
        "bg-inventory-hold text-inventory-hold-foreground ring-1 ring-inventory-hold-foreground/25 hover:brightness-[0.97] dark:hover:brightness-110",
      state.isOpenHoldBlocked &&
        !inRange &&
        !state.isOccupied &&
        !state.isInventoryHold &&
        "bg-stay-caution text-stay-caution-foreground ring-1 ring-stay-caution-foreground/30 hover:brightness-[0.97] dark:hover:brightness-110",
      state.isPast &&
        !inRange &&
        !state.isOccupied &&
        !state.isInventoryHold &&
        !state.isOpenHoldBlocked &&
        "text-muted-foreground",
      state.isToday &&
        !inRange &&
        !state.isOccupied &&
        !state.isInventoryHold &&
        !state.isOpenHoldBlocked &&
        "bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary",
      state.isMiddle && "rounded-none bg-primary/10 text-foreground",
      (state.isStart || state.isEnd) &&
        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
      state.isStart && state.isEnd && "rounded-md",
      state.isStart && !state.isEnd && "rounded-l-md rounded-r-none",
      state.isEnd && !state.isStart && "rounded-r-md rounded-l-none",
    );
  };

  const monthGrid = (
    <div className="flex flex-col gap-3 p-3 sm:min-w-[22rem]">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("reservations:stayDatePicker.previousYearAria")}
          onClick={() => {
            setMonthPickerYear((y) => y - 1);
          }}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            monthPickerYear === todayYear && "font-semibold text-primary",
          )}
        >
          {monthPickerYear}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("reservations:stayDatePicker.nextYearAria")}
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
        aria-label={t("reservations:stayDatePicker.durationLabel")}
      >
        {MONTH_SHORT.map((label, idx) => {
          const month = idx + 1;
          const state = monthCellState(monthPickerYear, month);
          return (
            <button
              key={label}
              type="button"
              role="gridcell"
              disabled={state.isStartBlocked}
              aria-selected={state.isStart || state.isEnd || state.isMiddle}
              aria-current={state.isToday ? "date" : undefined}
              aria-label={
                state.isOccupied
                  ? `${label} — ${labels.bookedNight}`
                  : state.isInventoryHold
                    ? `${label} — ${labels.inventoryHold}`
                    : state.isOpenHoldBlocked
                      ? `${label} — ${labels.openHoldBlocked}`
                      : undefined
              }
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
        {t("reservations:stayDatePicker.monthGridHint", {
          day: periodStartDay,
          sameDateHint: labels.sameDateHint,
        })}
      </p>
    </div>
  );

  const yearList = useMemo(() => {
    const years: number[] = [];
    for (
      let y = yearPickerCenter - YEAR_PICKER_BEFORE;
      y <= yearPickerCenter + YEAR_PICKER_AFTER;
      y += 1
    ) {
      years.push(y);
    }
    return years;
  }, [yearPickerCenter]);

  const yearGrid = (
    <div className="flex flex-col gap-3 p-3 sm:min-w-[18rem]">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("reservations:stayDatePicker.earlierYearsAria")}
          onClick={() => {
            setYearPickerCenter((y) => y - UNIT_OCCUPANCY_RANGE_MAX_YEARS);
          }}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {yearList[0]}–{yearList[yearList.length - 1]}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("reservations:stayDatePicker.laterYearsAria")}
          onClick={() => {
            setYearPickerCenter((y) => y + UNIT_OCCUPANCY_RANGE_MAX_YEARS);
          }}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <div
        className="grid grid-cols-3 gap-0"
        role="grid"
        aria-label={t("reservations:stayDatePicker.yearsLabel")}
      >
        {yearList.map((year) => {
          const state = yearCellState(year);
          return (
            <button
              key={year}
              type="button"
              role="gridcell"
              disabled={state.isStartBlocked}
              aria-selected={state.isStart || state.isEnd || state.isMiddle}
              aria-current={state.isToday ? "date" : undefined}
              aria-label={
                state.isOccupied
                  ? `${year} — ${labels.bookedNight}`
                  : state.isInventoryHold
                    ? `${year} — ${labels.inventoryHold}`
                    : state.isOpenHoldBlocked
                      ? `${year} — ${labels.openHoldBlocked}`
                      : undefined
              }
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
        {t("reservations:stayDatePicker.yearGridHint", {
          month: MONTH_SHORT[periodStartMonth - 1],
          day: periodStartDay,
          sameDateHint: labels.sameDateHint,
        })}
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
              if (!occupiedNights.has(ymd)) {
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
            inventoryHold: (date) => {
              if (!unitId) {
                return false;
              }
              const ymd = dateToYmd(date);
              if (!holdNights.has(ymd) || occupiedNights.has(ymd)) {
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
                  !modifiers.inventoryHold &&
                  !modifiers.turnaround
                }
                className={cn(
                  className,
                  modifiers.today &&
                    !modifiers.occupied &&
                    !modifiers.inventoryHold &&
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
                  modifiers.inventoryHold &&
                    !modifiers.occupied &&
                    cn(
                      "bg-inventory-hold! text-inventory-hold-foreground! opacity-100!",
                      "font-medium shadow-none",
                      "ring-1 ring-inset ring-inventory-hold-foreground/25",
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
            ),
          }}
        />
      </div>
    </>
  );

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
      {period === StayBillingPeriod.DAILY && dailyCalendar}
      {period === StayBillingPeriod.MONTHLY && monthGrid}
      {period === StayBillingPeriod.YEARLY && yearGrid}
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
            {period !== StayBillingPeriod.DAILY && openHoldBlockedBefore ? (
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
            {period === StayBillingPeriod.DAILY && pickingCheckOut && (
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
              {t("reservations:stayDatePicker.overlapsBusy", {
                busyNoun: labels.busyNoun,
              })}
            </>
          ) : draftComplete && draftPeriodCount != null ? (
            t("reservations:stayDatePicker.committedSummary", {
              count: draftPeriodCount,
              unit: durationUnitLabel(t, period, draftPeriodCount),
              exclusive: labels.exclusive,
            })
          ) : draftComplete && draftPeriodCount == null ? (
            <span className="text-destructive">
              {t("reservations:stayDatePicker.invalidBoundary", {
                unit: durationUnitLabel(t, period, 2),
              })}
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
        {periodAnchorFields}
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
          {period !== StayBillingPeriod.DAILY &&
            t("reservations:stayDatePicker.committedNightsOnCalendar", {
              count: nightCount(checkInDate, checkOutDate),
            })}
        </p>
      )}
    </div>
  );
}
