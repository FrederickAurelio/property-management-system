/* anchor: shadcn DatePicker + reservation stay trigger, diverge: YMD string value */
import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { dateToYmd, ymdToDate } from "@/pages/reports/reports-period";

type YmdDateFieldProps = {
  value: string;
  onChange: (ymd: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

/** Single-day picker: shadcn Popover + Calendar (same trigger register as stay dates). */
export function YmdDateField({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  triggerClassName,
}: YmdDateFieldProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const selected = ymdToDate(value);
  const emptyLabel = placeholder ?? t("dateField.pickDate");

  return (
    <div className={cn("min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={!selected}
            className={cn(
              "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
              triggerClassName,
            )}
          >
            <CalendarIcon data-icon="inline-start" />
            {selected ? format(selected, "PPP") : <span>{emptyLabel}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (!date) {
                return;
              }
              onChange(dateToYmd(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
