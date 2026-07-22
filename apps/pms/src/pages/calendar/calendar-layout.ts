/** Pure calendar window / span math (YYYY-MM-DD, exclusive end). */

export const CALENDAR_WINDOW_DAYS = 14;

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive day list for `[from, to)`. */
export function eachDayYmd(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  while (cursor < to) {
    days.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return days;
}

export function defaultRangeFromToday(today = todayYmdLocal()): {
  from: string;
  to: string;
} {
  return {
    from: today,
    to: addDaysYmd(today, CALENDAR_WINDOW_DAYS),
  };
}

export function shiftRange(
  from: string,
  to: string,
  direction: -1 | 1,
): { from: string; to: string } {
  const days = eachDayYmd(from, to).length || CALENDAR_WINDOW_DAYS;
  return {
    from: addDaysYmd(from, direction * days),
    to: addDaysYmd(to, direction * days),
  };
}

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dayFmt = new Intl.DateTimeFormat(undefined, { day: "numeric" });
const rangeFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function formatDayHeader(ymd: string): { weekday: string; day: string } {
  const date = ymdToLocalDate(ymd);
  return {
    weekday: weekdayFmt.format(date),
    day: dayFmt.format(date),
  };
}

export function formatRangeLabel(from: string, to: string): string {
  const lastInclusive = addDaysYmd(to, -1);
  return `${rangeFmt.format(ymdToLocalDate(from))} – ${rangeFmt.format(ymdToLocalDate(lastInclusive))}`;
}

/**
 * Map an occupying interval onto day columns.
 * Returns null when fully outside the visible window.
 */
export function spanColumns(
  startDate: string,
  endDate: string,
  days: readonly string[],
): { startIndex: number; endIndex: number } | null {
  if (days.length === 0) return null;
  const windowFrom = days[0]!;
  const windowTo = addDaysYmd(days[days.length - 1]!, 1);
  if (endDate <= windowFrom || startDate >= windowTo) return null;

  let startIndex = 0;
  while (startIndex < days.length && days[startIndex]! < startDate) {
    startIndex += 1;
  }
  let endIndex = days.length;
  while (endIndex > 0 && days[endIndex - 1]! >= endDate) {
    endIndex -= 1;
  }
  if (startIndex >= endIndex) return null;
  return { startIndex, endIndex };
}

export type UnitTypeGroup<TUnit> = {
  key: string;
  label: string;
  units: TUnit[];
};

/** Group units by type (sortOrder then name); null type → Ungrouped last. */
export function groupUnitsByType<
  TUnit extends {
    unitType: { id: string; name: string; sortOrder: number } | null;
    sortOrder: number;
    code: string;
  },
>(units: readonly TUnit[]): UnitTypeGroup<TUnit>[] {
  const map = new Map<
    string,
    {
      label: string;
      sortOrder: number;
      units: TUnit[];
    }
  >();

  for (const unit of units) {
    const key = unit.unitType?.id ?? "__ungrouped__";
    const existing = map.get(key);
    if (existing) {
      existing.units.push(unit);
    } else {
      map.set(key, {
        label: unit.unitType?.name ?? "Ungrouped",
        sortOrder: unit.unitType?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        units: [unit],
      });
    }
  }

  const groups = [...map.entries()].map(([key, value]) => {
    value.units.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
    );
    return { key, label: value.label, sortOrder: value.sortOrder, units: value.units };
  });

  groups.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );

  return groups.map(({ key, label, units: grouped }) => ({
    key,
    label,
    units: grouped,
  }));
}
