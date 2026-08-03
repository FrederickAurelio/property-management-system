/* anchor: Stripe-data period filters, diverge: dates+compare+export one row; mobile denser */
import { format } from "date-fns";
import { CalendarIcon, DownloadIcon } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  activePresetId,
  dateToYmd,
  formatPeriodChrome,
  previousEqualPeriod,
  rangeForPreset,
  REPORTS_PERIOD_PRESETS,
  reportsPeriodPresetLabel,
  type ReportsPeriodPresetId,
  todayYmdLocal,
  ymdToDate,
} from "./reports-period";

type ReportsFilterBarProps = {
  propertyId: string;
  properties: StaffPropertyOption[];
  propertiesLoading?: boolean;
  from: string;
  to: string;
  compare: boolean;
  compareWindow: { from: string; to: string } | null;
  exportDisabled?: boolean;
  onPropertyChange: (propertyId: string) => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  onRangeChange: (from: string, to: string) => void;
  onCompareChange: (compare: boolean) => void;
  onExport: () => void;
};

function DatePickerField({
  id,
  label,
  value,
  onChange,
  minYmd,
  maxYmd,
  className,
  triggerClassName,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (ymd: string) => void;
  minYmd?: string;
  maxYmd?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = ymdToDate(value);
  const minDate = minYmd ? ymdToDate(minYmd) : undefined;
  const maxDate = maxYmd ? ymdToDate(maxYmd) : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
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
              triggerClassName,
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

function PresetRow({
  preset,
  onPick,
  className,
}: {
  preset: ReportsPeriodPresetId | null;
  onPick: (id: ReportsPeriodPresetId) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex scrollbar-none gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {REPORTS_PERIOD_PRESETS.map((p) => (
        <Button
          key={p.id}
          type="button"
          size="sm"
          variant={preset === p.id ? "secondary" : "outline"}
          className="h-7 shrink-0 px-2 text-xs md:h-7 md:px-2.5"
          onClick={() => {
            onPick(p.id);
          }}
        >
          {reportsPeriodPresetLabel(p.id)}
        </Button>
      ))}
    </div>
  );
}

function PropertySelect({
  propertyId,
  properties,
  propertiesLoading,
  onPropertyChange,
  triggerClassName,
  size = "default",
}: {
  propertyId: string;
  properties: StaffPropertyOption[];
  propertiesLoading?: boolean;
  onPropertyChange: (propertyId: string) => void;
  triggerClassName?: string;
  size?: "sm" | "default";
}) {
  const { t } = useTranslation(["reports", "common"]);
  return (
    <Select
      value={propertyId || undefined}
      onValueChange={(id) => {
        if (id) onPropertyChange(id);
      }}
      disabled={propertiesLoading || properties.length === 0}
    >
      <SelectTrigger size={size} className={triggerClassName}>
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
  );
}

export function ReportsFilterBar({
  propertyId,
  properties,
  propertiesLoading,
  from,
  to,
  compare,
  compareWindow,
  exportDisabled,
  onPropertyChange,
  onFromChange,
  onToChange,
  onRangeChange,
  onCompareChange,
  onExport,
}: ReportsFilterBarProps) {
  const { t } = useTranslation(["reports", "common"]);
  const today = todayYmdLocal();
  const preset = activePresetId(from, to, today);
  const resolvedCompare =
    compareWindow ?? (compare ? previousEqualPeriod(from, to) : null);
  const chrome = formatPeriodChrome(from, to, compare ? resolvedCompare : null);

  const applyPreset = (id: ReportsPeriodPresetId) => {
    const r = rangeForPreset(id, today);
    onRangeChange(r.from, r.to);
  };

  return (
    <div
      className={cn(
        "-mx-4 border-b border-border bg-background px-4 py-2 md:-mx-6 md:px-6 md:py-2.5",
        "md:sticky md:top-12 md:z-20 md:bg-background/95 md:backdrop-blur",
      )}
    >
      {/* Mobile — denser controls; property · dates · compare+export · chrome */}
      <div className="flex flex-col gap-1.5 md:hidden">
        <PresetRow
          preset={preset}
          onPick={applyPreset}
          className="-mx-1 px-1"
        />

        <div className="flex min-w-0 flex-col gap-0.5">
          <Label className="text-xs text-muted-foreground">
            {t("reports:filterBar.propertyPlaceholder")}
          </Label>
          <PropertySelect
            propertyId={propertyId}
            properties={properties}
            propertiesLoading={propertiesLoading}
            onPropertyChange={onPropertyChange}
            size="sm"
            triggerClassName="w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <DatePickerField
            id="reports-from"
            label={t("reports:filterBar.fromLabel")}
            value={from}
            maxYmd={to}
            onChange={onFromChange}
          />
          <DatePickerField
            id="reports-to"
            label={t("reports:filterBar.toLabel")}
            value={to}
            minYmd={from}
            onChange={onToChange}
          />
        </div>

        <div className="flex h-7 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Switch
              id="reports-compare"
              checked={compare}
              onCheckedChange={onCompareChange}
              size="sm"
            />
            <Label
              htmlFor="reports-compare"
              className="cursor-pointer text-xs font-normal"
            >
              {t("reports:filterBar.compare")}
            </Label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            disabled={exportDisabled}
            onClick={onExport}
          >
            <DownloadIcon data-icon="inline-start" />
            {t("reports:filterBar.export")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{chrome}</p>
      </div>

      {/* Desktop — property+presets; then From/To + Compare + Export same row */}
      <div className="hidden flex-col gap-2 md:flex">
        <div className="flex flex-wrap items-center gap-2">
          <PropertySelect
            propertyId={propertyId}
            properties={properties}
            propertiesLoading={propertiesLoading}
            onPropertyChange={onPropertyChange}
            triggerClassName="h-9 w-[200px]"
          />
          <PresetRow preset={preset} onPick={applyPreset} />
          <p className="ml-auto text-xs text-muted-foreground">{chrome}</p>
        </div>

        <div className="flex flex-nowrap items-center gap-2">
          <DatePickerField
            id="reports-from-md"
            label={t("reports:filterBar.fromLabel")}
            value={from}
            maxYmd={to}
            onChange={onFromChange}
            className="shrink-0 gap-0"
          />
          <DatePickerField
            id="reports-to-md"
            label={t("reports:filterBar.toLabel")}
            value={to}
            minYmd={from}
            onChange={onToChange}
            className="shrink-0 gap-0"
          />

          <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

          <div className="flex items-center gap-2">
            <Switch
              id="reports-compare-md"
              checked={compare}
              onCheckedChange={onCompareChange}
              size="sm"
            />
            <Label
              htmlFor="reports-compare-md"
              className="cursor-pointer text-sm font-normal whitespace-nowrap"
            >
              {t("reports:filterBar.compare")}
            </Label>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-9 shrink-0"
            disabled={exportDisabled}
            onClick={onExport}
          >
            <DownloadIcon data-icon="inline-start" />
            {t("reports:filterBar.exportExcel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
