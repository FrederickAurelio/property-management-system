/* anchor: shadcn DatePicker trigger + month grid, diverge: YYYY-MM (no day) */
import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const YM_RE = /^\d{4}-\d{2}$/;

function parseYearMonth(ym: string): { y: number; m: number } | null {
  if (!YM_RE.test(ym)) {
    return null;
  }
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  if (!Number.isFinite(y) || m < 1 || m > 12) {
    return null;
  }
  return { y, m };
}

function formatYearMonth(ym: string): string {
  const parts = parseYearMonth(ym);
  if (!parts) {
    return ym;
  }
  return format(new Date(parts.y, parts.m - 1, 1), "MMM yyyy");
}

type YearMonthFieldProps = {
  value: string;
  onChange: (yearMonth: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

/** Calendar-month picker (`YYYY-MM`) — no day; not native `type="month"`. */
export function YearMonthField({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  triggerClassName,
}: YearMonthFieldProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const parsed = parseYearMonth(value);
  const [viewYear, setViewYear] = useState(
    () => parsed?.y ?? new Date().getFullYear(),
  );
  const emptyLabel = placeholder ?? t("dateField.pickMonth");
  const months = Array.from({ length: 12 }, (_, i) => ({
    m: i + 1,
    label: format(new Date(viewYear, i, 1), "MMM"),
  }));

  return (
    <div className={cn("min-w-0", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setViewYear(parsed?.y ?? new Date().getFullYear());
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={!parsed}
            className={cn(
              "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
              triggerClassName,
            )}
          >
            <CalendarIcon data-icon="inline-start" />
            {parsed ? formatYearMonth(value) : <span>{emptyLabel}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[16.5rem] p-3" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("dateField.previousYear")}
                onClick={() => {
                  setViewYear((y) => y - 1);
                }}
              >
                <ChevronLeftIcon />
              </Button>
              <p className="text-sm font-medium tabular-nums">{viewYear}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("dateField.nextYear")}
                onClick={() => {
                  setViewYear((y) => y + 1);
                }}
              >
                <ChevronRightIcon />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {months.map((month) => {
                const ym = `${viewYear}-${String(month.m).padStart(2, "0")}`;
                const selected = value === ym;
                return (
                  <Button
                    key={month.m}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    className="h-8 font-normal"
                    onClick={() => {
                      onChange(ym);
                      setOpen(false);
                    }}
                  >
                    {month.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
