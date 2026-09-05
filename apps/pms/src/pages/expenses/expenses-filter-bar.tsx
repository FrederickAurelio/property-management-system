/* anchor: Stripe-data period filters, diverge: expenses ledger without compare/export */
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { StaffPropertyOption } from "@cabin/api-contract";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { calendarOpsProps } from "@/lib/ops-date";
import {
  activePresetId,
  dateToYmd,
  formatInclusiveRangeLabel,
  rangeForPreset,
  REPORTS_PERIOD_PRESETS,
  reportsPeriodPresetLabel,
  type ReportsPeriodPresetId,
  ymdToDate,
} from "@/pages/reports/reports-period";

type ExpensesFilterBarProps = {
  propertyId: string;
  properties: StaffPropertyOption[];
  propertiesLoading?: boolean;
  today: string;
  timezone: string;
  from: string;
  to: string;
  onPropertyChange: (propertyId: string) => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  onRangeChange: (from: string, to: string) => void;
  onAdd: () => void;
};

function DatePickerField({
  id,
  label,
  value,
  onChange,
  minYmd,
  maxYmd,
  calendarTodayProps,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (ymd: string) => void;
  minYmd?: string;
  maxYmd?: string;
  calendarTodayProps: { timeZone: string; today: Date };
}) {
  const [open, setOpen] = useState(false);
  const selected = ymdToDate(value);
  const minDate = minYmd ? ymdToDate(minYmd) : undefined;
  const maxDate = maxYmd ? ymdToDate(maxYmd) : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground md:sr-only">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "h-7 w-full justify-start gap-1.5 px-2 text-xs font-normal md:h-9 md:w-[9.5rem] md:gap-2 md:px-3 md:text-sm",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon data-icon="inline-start" />
            <span className="truncate">
              {selected ? format(selected, "d MMM yyyy") : label}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            timeZone={calendarTodayProps.timeZone}
            today={calendarTodayProps.today}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            onSelect={(date) => {
              if (!date) return;
              onChange(dateToYmd(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ExpensesFilterBar({
  propertyId,
  properties,
  propertiesLoading,
  today,
  timezone,
  from,
  to,
  onPropertyChange,
  onFromChange,
  onToChange,
  onRangeChange,
  onAdd,
}: ExpensesFilterBarProps) {
  const { t } = useTranslation(["expenses", "reports", "common"]);
  const calendarTodayProps = calendarOpsProps(timezone);
  const preset = activePresetId(from, to, today);

  const applyPreset = (id: ReportsPeriodPresetId) => {
    const r = rangeForPreset(id, today);
    onRangeChange(r.from, r.to);
  };

  return (
    <div className="-mx-4 border-b border-border bg-background px-4 py-2 md:-mx-6 md:px-6 md:py-2.5 md:sticky md:top-12 md:z-20 md:bg-background/95 md:backdrop-blur">
      <div className="flex flex-col gap-1.5 md:hidden">
        <div className="flex scrollbar-none gap-1 overflow-x-auto">
          {REPORTS_PERIOD_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={preset === p.id ? "secondary" : "outline"}
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => {
                applyPreset(p.id);
              }}
            >
              {reportsPeriodPresetLabel(p.id)}
            </Button>
          ))}
        </div>
        <Select
          value={propertyId || undefined}
          onValueChange={(id) => {
            if (id) onPropertyChange(id);
          }}
          disabled={propertiesLoading || properties.length === 0}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder={t("reports:filterBar.propertyPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-1.5">
          <DatePickerField
            id="expenses-from"
            label={t("reports:filterBar.fromLabel")}
            value={from}
            maxYmd={to}
            calendarTodayProps={calendarTodayProps}
            onChange={onFromChange}
          />
          <DatePickerField
            id="expenses-to"
            label={t("reports:filterBar.toLabel")}
            value={to}
            minYmd={from}
            calendarTodayProps={calendarTodayProps}
            onChange={onToChange}
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9"
          disabled={!propertyId}
          onClick={onAdd}
        >
          {t("expenses:page.add")}
        </Button>
      </div>

      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <Select
          value={propertyId || undefined}
          onValueChange={(id) => {
            if (id) onPropertyChange(id);
          }}
          disabled={propertiesLoading || properties.length === 0}
        >
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder={t("reports:filterBar.propertyPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {REPORTS_PERIOD_PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={preset === p.id ? "secondary" : "outline"}
            className="h-9 shrink-0"
            onClick={() => {
              applyPreset(p.id);
            }}
          >
            {reportsPeriodPresetLabel(p.id)}
          </Button>
        ))}
        <DatePickerField
          id="expenses-from-md"
          label={t("reports:filterBar.fromLabel")}
          value={from}
          maxYmd={to}
          calendarTodayProps={calendarTodayProps}
          onChange={onFromChange}
        />
        <DatePickerField
          id="expenses-to-md"
          label={t("reports:filterBar.toLabel")}
          value={to}
          minYmd={from}
          calendarTodayProps={calendarTodayProps}
          onChange={onToChange}
        />
        <p className="text-xs text-muted-foreground">
          {formatInclusiveRangeLabel(from, to)}
        </p>
        <Button
          type="button"
          className="ml-auto h-9"
          disabled={!propertyId}
          onClick={onAdd}
        >
          {t("expenses:page.add")}
        </Button>
      </div>
    </div>
  );
}
