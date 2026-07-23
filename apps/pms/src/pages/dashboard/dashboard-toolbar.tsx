/* anchor: Linear-dense desk chrome, diverge: title+date left; property+Sync right — one toolbar row */
import { RefreshCwIcon } from "lucide-react";
import type { StaffPropertyOption } from "@cabin/api-contract";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDashboardTodayLabel } from "./dashboard-format";

type DashboardToolbarProps = {
  propertyId: string;
  properties: StaffPropertyOption[];
  propertiesLoading?: boolean;
  date: string | null;
  onPropertyChange: (propertyId: string) => void;
  onSyncAll: () => void;
};

export function DashboardToolbar({
  propertyId,
  properties,
  propertiesLoading,
  date,
  onPropertyChange,
  onSyncAll,
}: DashboardToolbarProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">Today</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {date
            ? formatDashboardTodayLabel(date)
            : "Arrivals, departures, and exceptions for this property."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Select
          value={propertyId || undefined}
          onValueChange={onPropertyChange}
          disabled={propertiesLoading || properties.length === 0}
        >
          <SelectTrigger className="h-9 w-full min-w-44 sm:w-56" aria-label="Property">
            <SelectValue placeholder="Select property" />
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

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0"
          onClick={onSyncAll}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Sync all
        </Button>
      </div>
    </header>
  );
}
