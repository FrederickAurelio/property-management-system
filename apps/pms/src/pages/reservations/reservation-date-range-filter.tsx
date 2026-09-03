/* anchor: Linear-dense filter chip + Stripe period popover, diverge: split Start/End; End = All */
import { useState } from "react";
import { CalendarIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { calendarOpsProps } from "@/lib/ops-date";
import { cn } from "@/lib/utils";
import {
  activeStayPresetId,
  dateToYmd,
  formatStayTouchFromDate,
  formatStayTouchTriggerLabel,
  rangeForStayPreset,
  STAY_RANGE_PRESETS,
  type StayRangePresetId,
  ymdToDate,
} from "./reservation-stay-range";

type ReservationDateRangeFilterProps = {
  from: string;
  to: string;
  opsTodayYmd: string;
  propertyTimezone: string;
  onPatch: (patch: Record<string, string | null>) => void;
};

type StayTouchDraft = {
  start: Date | undefined;
  end: Date | undefined;
};

function toDraft(from: string, to: string): StayTouchDraft {
  return {
    start: from ? (ymdToDate(from) ?? undefined) : undefined,
    end: to ? (ymdToDate(to) ?? undefined) : undefined,
  };
}

function draftPresetId(
  draft: StayTouchDraft,
  opsToday: string,
): StayRangePresetId | null {
  if (!draft.start || !draft.end) return null;
  return activeStayPresetId(
    dateToYmd(draft.start),
    dateToYmd(draft.end),
    opsToday,
  );
}

function presetKey(id: StayRangePresetId): "thisWeek" | "thisMonth" | "next30" {
  switch (id) {
    case "this-week":
      return "thisWeek";
    case "this-month":
      return "thisMonth";
    case "next-30":
      return "next30";
  }
}

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function StayRangePanel({
  draft,
  onStartChange,
  onEndChange,
  onClearEnd,
  onPreset,
  onClearDraft,
  activePreset,
  calendarTodayProps,
}: {
  draft: StayTouchDraft;
  onStartChange: (next: Date | undefined) => void;
  onEndChange: (next: Date | undefined) => void;
  onClearEnd: () => void;
  onPreset: (id: StayRangePresetId) => void;
  onClearDraft: () => void;
  activePreset: StayRangePresetId | null;
  calendarTodayProps: { timeZone: string; today: Date };
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const endIsAll = Boolean(draft.start && !draft.end);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {STAY_RANGE_PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={activePreset === p.id ? "secondary" : "outline"}
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => {
              onPreset(p.id);
            }}
          >
            {t(`reservations:filtersBar.datePresets.${presetKey(p.id)}`)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          onClick={onClearDraft}
        >
          {t("reservations:filtersBar.dateClear")}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
        <div
          className={cn(
            "flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2.5",
            "dark:bg-muted/20",
          )}
        >
          <p className="px-0.5 text-xs font-medium text-foreground">
            {t("reservations:filtersBar.dateStartLabel")}
          </p>
          <Calendar
            mode="single"
            numberOfMonths={1}
            selected={draft.start}
            defaultMonth={draft.start}
            timeZone={calendarTodayProps.timeZone}
            today={calendarTodayProps.today}
            onSelect={onStartChange}
            className="rounded-md border border-border/80 bg-background"
          />
        </div>
        <div
          className={cn(
            "flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2.5",
            "dark:bg-muted/20",
          )}
        >
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-xs font-medium text-foreground">
              {t("reservations:filtersBar.dateEndLabel")}
            </p>
            <Button
              type="button"
              size="sm"
              variant={endIsAll ? "secondary" : "outline"}
              className="h-6 shrink-0 px-1.5 text-xs"
              disabled={!draft.start}
              onClick={onClearEnd}
              aria-pressed={endIsAll}
              aria-label={t("reservations:filtersBar.dateEndAllAria")}
            >
              {t("reservations:filtersBar.dateEndAll")}
            </Button>
          </div>
          <Calendar
            mode="single"
            numberOfMonths={1}
            selected={draft.end}
            defaultMonth={draft.end ?? draft.start}
            timeZone={calendarTodayProps.timeZone}
            today={calendarTodayProps.today}
            disabled={
              draft.start ? { before: dayStart(draft.start) } : () => true
            }
            onSelect={onEndChange}
            className="rounded-md border border-border/80 bg-background"
          />
        </div>
      </div>
    </div>
  );
}

function ConfirmFooter({
  canConfirm,
  onCancel,
  onConfirm,
  fullWidth,
}: {
  canConfirm: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  fullWidth?: boolean;
}) {
  const { t } = useTranslation(["reservations", "common"]);

  return (
    <div
      className={cn(
        "flex gap-2",
        fullWidth ? "w-full flex-col-reverse sm:flex-row" : "justify-end",
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(fullWidth && "w-full sm:w-auto")}
        onClick={onCancel}
      >
        {t("reservations:filtersBar.dateCancel")}
      </Button>
      <Button
        type="button"
        size="sm"
        className={cn(fullWidth && "w-full sm:w-auto")}
        disabled={!canConfirm}
        onClick={onConfirm}
      >
        {t("reservations:filtersBar.dateConfirm")}
      </Button>
    </div>
  );
}

export function ReservationDateRangeFilter({
  from,
  to,
  opsTodayYmd,
  propertyTimezone,
  onPatch,
}: ReservationDateRangeFilterProps) {
  const { t } = useTranslation(["reservations", "common"]);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StayTouchDraft>(() => toDraft(from, to));
  const calendarTodayProps = calendarOpsProps(propertyTimezone);

  const hasApplied = Boolean(from);
  const activePreset = draftPresetId(draft, opsTodayYmd);
  /** Start set (end optional), or empty draft (= All dates). End-only is invalid. */
  const canConfirm = (!draft.start && !draft.end) || Boolean(draft.start);

  function openPanel(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(toDraft(from, to));
    }
    setOpen(nextOpen);
  }

  function cancelPanel() {
    setDraft(toDraft(from, to));
    setOpen(false);
  }

  function confirmDraft() {
    if (!canConfirm) return;
    if (draft.start) {
      onPatch({
        from: dateToYmd(draft.start),
        to: draft.end ? dateToYmd(draft.end) : null,
      });
    } else {
      onPatch({ from: null, to: null });
    }
    setOpen(false);
  }

  function clearApplied() {
    onPatch({ from: null, to: null });
    setDraft({ start: undefined, end: undefined });
    setOpen(false);
  }

  function selectPreset(id: StayRangePresetId) {
    const r = rangeForStayPreset(id, opsTodayYmd);
    setDraft({
      start: ymdToDate(r.from) ?? undefined,
      end: ymdToDate(r.to) ?? undefined,
    });
  }

  function setStart(next: Date | undefined) {
    setDraft((prev) => {
      if (!next) {
        return { start: undefined, end: undefined };
      }
      const end =
        prev.end && dayStart(prev.end) < dayStart(next) ? undefined : prev.end;
      return { start: next, end };
    });
  }

  function setEnd(next: Date | undefined) {
    setDraft((prev) => {
      if (!prev.start || !next) {
        return { ...prev, end: undefined };
      }
      if (dayStart(next) < dayStart(prev.start)) {
        return prev;
      }
      return { ...prev, end: next };
    });
  }

  const triggerLabel = from
    ? to
      ? formatStayTouchTriggerLabel(from, to)
      : t("reservations:filtersBar.fromDateOpen", {
          date: formatStayTouchFromDate(from),
        })
    : t("reservations:filtersBar.allDates");

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-8 min-w-0 flex-1 justify-start gap-1.5 px-2 font-normal",
        hasApplied ? "rounded-r-none border-r-0" : "w-[10.5rem]",
        !hasApplied && "text-muted-foreground",
      )}
      aria-label={t("reservations:filtersBar.dateAria")}
      onClick={() => {
        if (!isMobile) return;
        openPanel(true);
      }}
    >
      <CalendarIcon className="size-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
    </Button>
  );

  const clearButton = hasApplied && (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 w-8 shrink-0 rounded-l-none px-0"
      aria-label={t("reservations:filtersBar.dateClear")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        clearApplied();
      }}
    >
      <XIcon className="size-3.5" />
    </Button>
  );

  const trigger = (
    <div className="flex w-[10.5rem] shrink-0 items-center">
      {isMobile ? (
        triggerButton
      ) : (
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      )}
      {clearButton}
    </div>
  );

  const panel = (
    <StayRangePanel
      draft={draft}
      onStartChange={setStart}
      onEndChange={setEnd}
      onClearEnd={() => {
        setDraft((prev) => ({ ...prev, end: undefined }));
      }}
      onPreset={selectPreset}
      onClearDraft={() => {
        setDraft({ start: undefined, end: undefined });
      }}
      activePreset={activePreset}
      calendarTodayProps={calendarTodayProps}
    />
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={openPanel}>
          <SheetContent
            side="bottom"
            className="flex max-h-[90svh] flex-col gap-0 p-0"
          >
            <SheetHeader className="border-b border-border px-4 py-3 text-left">
              <SheetTitle>
                {t("reservations:filtersBar.dateSheetTitle")}
              </SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {panel}
            </div>
            <SheetFooter className="border-t border-border px-4 py-3">
              <ConfirmFooter
                fullWidth
                canConfirm={canConfirm}
                onCancel={cancelPanel}
                onConfirm={confirmDraft}
              />
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={openPanel}>
      {trigger}
      <PopoverContent className="w-auto p-3" align="end">
        <div className="flex flex-col gap-3">
          {panel}
          <ConfirmFooter
            canConfirm={canConfirm}
            onCancel={cancelPanel}
            onConfirm={confirmDraft}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
