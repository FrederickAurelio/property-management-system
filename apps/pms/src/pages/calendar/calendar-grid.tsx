/* anchor: Linear-dense / Stripe-data calendar grid, diverge: frozen unit col + absolute bars */
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isOccupyingReservationStatus,
  isUnitStatusBookable,
  ReservationStatus,
  type StaffCalendarBlock,
  type StaffCalendarStay,
  type StaffCalendarUnit,
  type StaffPropertyCalendar,
} from "@cabin/api-contract";
import { ChevronDownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { STICKY_LABEL_COL_CSS } from "@/lib/sticky-label-col";
import { cn } from "@/lib/utils";
import { CalendarBlockBar } from "./calendar-block-bar";
import {
  eachDayYmd,
  formatDayHeader,
  groupUnitsByType,
  barBoxStyle,
  spanColumns,
} from "./calendar-layout";
import {
  isDayInSelection,
  selectionFromDrag,
  unitLabel,
  type CalendarSelection,
  type DragState,
} from "./calendar-selection";
import { CalendarHistoryRail } from "./calendar-history-rail";
import { CalendarStayBar } from "./calendar-stay-bar";

const DAY_COL_MIN = 52;
const ROW_H = 44;
/** Sticky date row + group subheaders share h-11 so `top-11` stacks cleanly. */
const HEADER_ROW_CLASS = "h-11";

type CalendarGridProps = {
  data: StaffPropertyCalendar;
  todayYmd: string;
  onStayClick: (stay: StaffCalendarStay) => void;
  onBlockClick: (block: StaffCalendarBlock) => void;
  onEmptyRange: (selection: CalendarSelection, unit: StaffCalendarUnit) => void;
  className?: string;
};

export function CalendarGrid({
  data,
  todayYmd,
  onStayClick,
  onBlockClick,
  onEmptyRange,
  className,
}: CalendarGridProps) {
  const { t } = useTranslation("calendar");
  const days = useMemo(
    () => eachDayYmd(data.from, data.to),
    [data.from, data.to],
  );
  const groups = useMemo(() => groupUnitsByType(data.units), [data.units]);
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const staysByUnit = useMemo(() => {
    const map = new Map<string, StaffCalendarStay[]>();
    for (const stay of data.stays) {
      const list = map.get(stay.unitId) ?? [];
      list.push(stay);
      map.set(stay.unitId, list);
    }
    return map;
  }, [data.stays]);

  const blocksByUnit = useMemo(() => {
    const map = new Map<string, StaffCalendarBlock[]>();
    for (const block of data.blocks) {
      const list = map.get(block.unitId) ?? [];
      list.push(block);
      map.set(block.unitId, list);
    }
    return map;
  }, [data.blocks]);

  const setDragBoth = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const finishDrag = useCallback(
    (unit: StaffCalendarUnit) => {
      const current = dragRef.current;
      setDragBoth(null);
      if (!current || current.unitId !== unit.id) return;
      if (!isUnitStatusBookable(unit.status)) return;
      onEmptyRange(selectionFromDrag(current), unit);
    },
    [onEmptyRange, setDragBoth],
  );

  const unitsById = useMemo(() => {
    const map = new Map<string, StaffCalendarUnit>();
    for (const u of data.units) map.set(u.id, u);
    return map;
  }, [data.units]);

  const toggleGroupCollapsed = useCallback((groupKey: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!drag) return;
    const onUp = () => {
      const current = dragRef.current;
      if (!current) return;
      const unit = unitsById.get(current.unitId);
      if (unit) {
        finishDrag(unit);
      } else {
        setDragBoth(null);
      }
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [drag, finishDrag, setDragBoth, unitsById]);

  const daysWidth = `minmax(${days.length * DAY_COL_MIN}px, 1fr)`;
  const unitCol = STICKY_LABEL_COL_CSS;

  return (
    <div
      className={cn(
        "min-h-0 overflow-auto rounded-lg border border-border",
        className,
      )}
    >
      <div className="min-w-max">
        <div
          className={cn(
            "sticky top-0 z-20 grid border-b border-border bg-background shadow-sm",
            HEADER_ROW_CLASS,
          )}
          style={{
            gridTemplateColumns: `${unitCol} ${daysWidth}`,
          }}
        >
          <div className="sticky left-0 z-30 flex min-w-0 items-end border-r border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
            {t("calendar:grid.unitColumn")}
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(${DAY_COL_MIN}px, 1fr))`,
            }}
          >
            {days.map((ymd) => {
              const { weekday, day } = formatDayHeader(ymd);
              const isToday = ymd === todayYmd;
              return (
                <div
                  key={ymd}
                  className={cn(
                    "flex flex-col items-center justify-center border-r border-border/60 px-0.5 py-1.5 text-center last:border-r-0",
                    isToday && "bg-primary/5",
                  )}
                >
                  <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                    {weekday}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      isToday && "text-primary",
                    )}
                  >
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {groups.map((group) => {
          const isCollapsed = collapsedGroupKeys.has(group.key);
          return (
            <div key={group.key}>
              <button
                type="button"
                className={cn(
                  "sticky top-11 z-15 flex w-full min-w-max border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted/60",
                  HEADER_ROW_CLASS,
                )}
                onClick={() => toggleGroupCollapsed(group.key)}
                aria-expanded={!isCollapsed}
                aria-label={
                  isCollapsed
                    ? t("calendar:grid.expandGroup", { name: group.label })
                    : t("calendar:grid.collapseGroup", { name: group.label })
                }
              >
                <span
                  className="sticky left-0 z-16 flex min-w-0 items-start gap-1 bg-muted px-2 py-1.5"
                  style={{ maxWidth: unitCol, width: unitCol }}
                >
                  <ChevronDownIcon
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                      isCollapsed && "-rotate-90",
                    )}
                    aria-hidden
                  />
                  <span
                    className="line-clamp-2 min-w-0 leading-4 wrap-break-word"
                    title={group.label}
                  >
                    {group.label}
                  </span>
                </span>
              </button>
              {!isCollapsed &&
                group.units.map((unit) => {
                  const bookable = isUnitStatusBookable(unit.status);
                  const unitStays = staysByUnit.get(unit.id) ?? [];
                  const historyStays = unitStays.filter(
                    (stay) => stay.status === ReservationStatus.CHECKED_OUT,
                  );
                  const occupyingStays = unitStays.filter((stay) =>
                    isOccupyingReservationStatus(stay.status),
                  );
                  const unitBlocks = blocksByUnit.get(unit.id) ?? [];
                  return (
                    <div
                      key={unit.id}
                      className={cn(
                        "grid border-b border-border last:border-b-0",
                        !bookable && "opacity-60",
                      )}
                      style={{
                        gridTemplateColumns: `${unitCol} ${daysWidth}`,
                        minHeight: ROW_H,
                      }}
                    >
                      <div
                        className={cn(
                          "sticky left-0 z-10 flex min-w-0 items-center gap-1.5 overflow-hidden border-r border-border bg-background px-3 text-sm",
                          !bookable && "text-muted-foreground",
                        )}
                        style={{ minHeight: ROW_H }}
                        title={unitLabel(unit)}
                      >
                        <span className="min-w-0 truncate font-medium">
                          {unit.code}
                        </span>
                        {!bookable && (
                          <span className="shrink-0 rounded border border-border px-1 text-[10px] text-muted-foreground">
                            {unit.status === "MAINTENANCE"
                              ? t("calendar:grid.maintenance")
                              : t("calendar:grid.off")}
                          </span>
                        )}
                      </div>

                      <div
                        className="relative"
                        style={{ minHeight: ROW_H }}
                        onPointerLeave={() => {
                          if (dragRef.current?.unitId === unit.id) {
                            /* keep drag until pointer up */
                          }
                        }}
                      >
                        <div
                          className="absolute inset-0 grid"
                          style={{
                            gridTemplateColumns: `repeat(${days.length}, minmax(${DAY_COL_MIN}px, 1fr))`,
                          }}
                        >
                          {days.map((ymd) => {
                            const isToday = ymd === todayYmd;
                            const selected = isDayInSelection(
                              unit.id,
                              ymd,
                              drag,
                              null,
                            );
                            return (
                              <div
                                key={ymd}
                                role="presentation"
                                className={cn(
                                  "border-r border-border/40 last:border-r-0",
                                  isToday && "bg-primary/5",
                                  selected && "bg-primary/15",
                                  bookable && "cursor-cell",
                                )}
                                onPointerDown={(e) => {
                                  if (!bookable || e.button !== 0) return;
                                  e.preventDefault();
                                  setDragBoth({
                                    unitId: unit.id,
                                    anchorYmd: ymd,
                                    hoverYmd: ymd,
                                  });
                                }}
                                onPointerEnter={() => {
                                  const current = dragRef.current;
                                  if (!current || current.unitId !== unit.id) {
                                    return;
                                  }
                                  setDragBoth({ ...current, hoverYmd: ymd });
                                }}
                              />
                            );
                          })}
                        </div>

                        {historyStays.map((stay) => {
                          const span = spanColumns(
                            stay.checkInDate,
                            stay.checkOutDate,
                            days,
                          );
                          if (!span) return null;
                          return (
                            <CalendarHistoryRail
                              key={stay.id}
                              stay={stay}
                              clippedStart={span.clippedStart}
                              clippedEnd={span.clippedEnd}
                              style={barBoxStyle(span, days.length)}
                              onClick={() => onStayClick(stay)}
                            />
                          );
                        })}
                        {occupyingStays.map((stay) => {
                          const hasOpenHold =
                            stay.inventoryEndDate > stay.checkOutDate;
                          if (!hasOpenHold) {
                            const span = spanColumns(
                              stay.checkInDate,
                              stay.inventoryEndDate,
                              days,
                            );
                            if (!span) return null;
                            return (
                              <CalendarStayBar
                                key={stay.id}
                                stay={stay}
                                segment="full"
                                clippedStart={span.clippedStart}
                                clippedEnd={span.clippedEnd}
                                style={barBoxStyle(span, days.length)}
                                onClick={() => onStayClick(stay)}
                              />
                            );
                          }

                          const contractSpan = spanColumns(
                            stay.checkInDate,
                            stay.checkOutDate,
                            days,
                          );
                          const holdSpan = spanColumns(
                            stay.checkOutDate,
                            stay.inventoryEndDate,
                            days,
                          );
                          return (
                            <Fragment key={stay.id}>
                              {contractSpan && (
                                <CalendarStayBar
                                  stay={stay}
                                  segment="contract"
                                  clippedStart={contractSpan.clippedStart}
                                  clippedEnd={
                                    contractSpan.clippedEnd || Boolean(holdSpan)
                                  }
                                  style={barBoxStyle(contractSpan, days.length)}
                                  onClick={() => onStayClick(stay)}
                                />
                              )}
                              {holdSpan && (
                                <CalendarStayBar
                                  stay={stay}
                                  segment="hold"
                                  clippedStart={
                                    holdSpan.clippedStart ||
                                    Boolean(contractSpan)
                                  }
                                  clippedEnd={holdSpan.clippedEnd}
                                  style={barBoxStyle(holdSpan, days.length)}
                                  onClick={() => onStayClick(stay)}
                                />
                              )}
                            </Fragment>
                          );
                        })}
                        {unitBlocks.map((block) => {
                          const span = spanColumns(
                            block.startDate,
                            block.endDate,
                            days,
                          );
                          if (!span) return null;
                          return (
                            <CalendarBlockBar
                              key={block.id}
                              block={block}
                              clippedStart={span.clippedStart}
                              clippedEnd={span.clippedEnd}
                              style={barBoxStyle(span, days.length)}
                              onClick={() => onBlockClick(block)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
