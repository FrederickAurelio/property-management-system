/* anchor: Linear-dense filter chip + Stripe period popover, diverge: draft then Confirm */
import { useState } from "react";
import { CalendarIcon, XIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
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
import { cn } from "@/lib/utils";
import {
  activeStayPresetId,
  dateToYmd,
  formatStayTouchTriggerLabel,
  rangeForStayPreset,
  STAY_RANGE_PRESETS,
  type StayRangePresetId,
  ymdToDate,
} from "./reservation-stay-range";

type ReservationDateRangeFilterProps = {
  from: string;
  to: string;
  onPatch: (patch: Record<string, string | null>) => void;
};

function rangeToDraft(from: string, to: string): DateRange | undefined {
  if (!from || !to) return undefined;
  const fromDate = ymdToDate(from);
  const toDate = ymdToDate(to);
  if (!fromDate || !toDate) return undefined;
  return { from: fromDate, to: toDate };
}

function draftPresetId(draft: DateRange | undefined): StayRangePresetId | null {
  if (!draft?.from || !draft.to) return null;
  return activeStayPresetId(dateToYmd(draft.from), dateToYmd(draft.to));
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

function StayRangePanel({
  draft,
  onDraftChange,
  onPreset,
  onClearDraft,
  activePreset,
}: {
  draft: DateRange | undefined;
  onDraftChange: (next: DateRange | undefined) => void;
  onPreset: (id: StayRangePresetId) => void;
  onClearDraft: () => void;
  activePreset: StayRangePresetId | null;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const isMobile = useIsMobile();

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
      <Calendar
        mode="range"
        numberOfMonths={isMobile ? 1 : 2}
        selected={draft}
        defaultMonth={draft?.from}
        onSelect={onDraftChange}
      />
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
  onPatch,
}: ReservationDateRangeFilterProps) {
  const { t } = useTranslation(["reservations", "common"]);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() =>
    rangeToDraft(from, to),
  );

  const hasRange = Boolean(from && to);
  const activePreset = draftPresetId(draft);
  /** Complete range, or empty draft (= All dates). Partial pick blocks Confirm. */
  const canConfirm =
    (!draft?.from && !draft?.to) || Boolean(draft?.from && draft.to);

  function openPanel(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(rangeToDraft(from, to));
    }
    setOpen(nextOpen);
  }

  function cancelPanel() {
    setDraft(rangeToDraft(from, to));
    setOpen(false);
  }

  function confirmDraft() {
    if (!canConfirm) return;
    if (draft?.from && draft.to) {
      onPatch({ from: dateToYmd(draft.from), to: dateToYmd(draft.to) });
    } else {
      onPatch({ from: null, to: null });
    }
    setOpen(false);
  }

  /** Trigger X — clear applied filter immediately (outside draft flow). */
  function clearApplied() {
    onPatch({ from: null, to: null });
    setDraft(undefined);
    setOpen(false);
  }

  function selectPreset(id: StayRangePresetId) {
    const r = rangeForStayPreset(id);
    setDraft({ from: ymdToDate(r.from), to: ymdToDate(r.to) });
  }

  const triggerLabel = hasRange
    ? formatStayTouchTriggerLabel(from, to)
    : t("reservations:filtersBar.allDates");

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-8 min-w-0 flex-1 justify-start gap-1.5 px-2 font-normal",
        hasRange ? "rounded-r-none border-r-0" : "w-[10.5rem]",
        !hasRange && "text-muted-foreground",
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

  const clearButton = hasRange && (
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
      onDraftChange={setDraft}
      onPreset={selectPreset}
      onClearDraft={() => {
        setDraft(undefined);
      }}
      activePreset={activePreset}
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
