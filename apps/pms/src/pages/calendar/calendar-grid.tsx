/* anchor: Linear-dense / Stripe-data calendar grid, diverge: frozen unit col + absolute bars */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isUnitStatusBookable,
  type StaffCalendarBlock,
  type StaffCalendarStay,
  type StaffCalendarUnit,
  type StaffPropertyCalendar,
} from "@cabin/api-contract";
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
import { CalendarStayBar } from "./calendar-stay-bar";

const DAY_COL_MIN = 52;
const ROW_H = 44;

type CalendarGridProps = {
  data: StaffPropertyCalendar;
  todayYmd: string;
  onStayClick: (stay: StaffCalendarStay) => void;
  onBlockClick: (block: StaffCalendarBlock) => void;
  onEmptyRange: (selection: CalendarSelection, unit: StaffCalendarUnit) => void;
};

export function CalendarGrid({
  data,
  todayYmd,
  onStayClick,
  onBlockClick,
  onEmptyRange,
}: CalendarGridProps) {
  const { t } = useTranslation("calendar");
  const days = useMemo(
    () => eachDayYmd(data.from, data.to),
    [data.from, data.to],
  );
  const groups = useMemo(() => groupUnitsByType(data.units), [data.units]);
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
    <div className="overflow-auto rounded-lg border border-border">
      <div className="min-w-max">
        <div
          className="sticky top-0 z-20 grid border-b border-border bg-background"
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

        {groups.map((group) => (
          <div key={group.key}>
            <div className="border-b border-border bg-muted/40 py-1.5 text-xs font-medium text-muted-foreground">
              <span
                className="sticky left-0 z-10 block min-w-0 truncate bg-muted px-3"
                style={{ maxWidth: unitCol }}
                title={group.label}
              >
                {group.label}
              </span>
            </div>
            {group.units.map((unit) => {
              const bookable = isUnitStatusBookable(unit.status);
              const unitStays = staysByUnit.get(unit.id) ?? [];
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

                    {unitStays.map((stay) => {
                      const span = spanColumns(
                        stay.checkInDate,
                        stay.checkOutDate,
                        days,
                      );
                      if (!span) return null;
                      return (
                        <CalendarStayBar
                          key={stay.id}
                          stay={stay}
                          clippedStart={span.clippedStart}
                          clippedEnd={span.clippedEnd}
                          style={barBoxStyle(span, days.length)}
                          onClick={() => onStayClick(stay)}
                        />
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
        ))}
      </div>
    </div>
  );
}
