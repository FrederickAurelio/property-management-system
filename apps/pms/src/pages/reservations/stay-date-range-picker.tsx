/* anchor: shadcn date-picker range, diverge: draft + Confirm before apply */
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
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

function formatRangeLabel(checkInDate: string, checkOutDate: string): string {
  if (checkInDate && checkOutDate) {
    return `${format(ymdToDate(checkInDate)!, "LLL d, y")} → ${format(ymdToDate(checkOutDate)!, "LLL d, y")}`;
  }
  if (checkInDate) {
    return `${format(ymdToDate(checkInDate)!, "LLL d, y")} → …`;
  }
  return "Pick check-in and check-out";
}

type StayDateRangePickerProps = {
  checkInDate: string;
  checkOutDate: string;
  onChange: (next: { checkInDate: string; checkOutDate: string }) => void;
  invalid?: boolean;
  id?: string;
};

export function StayDateRangePicker({
  checkInDate,
  checkOutDate,
  onChange,
  invalid = false,
  id = "stay-dates",
}: StayDateRangePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  /** Draft while the popover is open — form values only update on Confirm. */
  const [draft, setDraft] = useState<DateRange | undefined>(() =>
    rangeFromYmd(checkInDate, checkOutDate),
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(rangeFromYmd(checkInDate, checkOutDate));
  }, [open, checkInDate, checkOutDate]);

  const committedNights =
    checkInDate && checkOutDate
      ? nightCount(checkInDate, checkOutDate)
      : 0;

  const draftFrom = draft?.from ? dateToYmd(draft.from) : "";
  const draftTo = draft?.to ? dateToYmd(draft.to) : "";
  const draftComplete =
    Boolean(draftFrom && draftTo) && draftFrom !== draftTo;
  const draftNights = draftComplete
    ? nightCount(draftFrom, draftTo)
    : 0;
  const canConfirm = draftComplete && draftNights >= 1;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Discard unconfirmed draft when closing.
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

  return (
    <div className="flex flex-col gap-1.5">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            id={id}
            aria-invalid={invalid}
            data-empty={!checkInDate || !checkOutDate}
            className={cn(
              "w-full justify-start px-2.5 font-normal",
              "data-[empty=true]:text-muted-foreground",
            )}
          >
            <CalendarIcon data-icon="inline-start" />
            <span className="truncate">
              {formatRangeLabel(checkInDate, checkOutDate)}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={isMobile ? 1 : 2}
            defaultMonth={draft?.from ?? selectedMonth(checkInDate)}
            selected={draft}
            onSelect={(range) => {
              setDraft(range);
            }}
          />
          <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              {draftComplete
                ? `${draftNights === 1 ? "1 night" : `${draftNights} nights`} · check-out is exclusive`
                : draftFrom
                  ? "Pick check-out to finish the range"
                  : "Pick check-in, then check-out"}
            </p>
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
        </PopoverContent>
      </Popover>
      {committedNights > 0 && (
        <p className="text-xs text-muted-foreground">
          {committedNights === 1 ? "1 night" : `${committedNights} nights`}
          <span className="text-muted-foreground/80">
            {" "}
            · check-out is exclusive
          </span>
        </p>
      )}
    </div>
  );
}

function selectedMonth(checkInDate: string): Date {
  return ymdToDate(checkInDate) ?? new Date();
}
