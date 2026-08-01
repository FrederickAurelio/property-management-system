/* anchor: Linear-dense desk chrome, diverge: title+date left; property+Sync right — one toolbar row */
import { Link } from "react-router";
import { RefreshCwIcon } from "lucide-react";
import type {
  StaffDashboardIcalFeedHealth,
  StaffPropertyOption,
} from "@cabin/api-contract";
import { useTranslation } from "react-i18next";
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
  syncPending?: boolean;
  icalFeedHealth?: StaffDashboardIcalFeedHealth | null;
  /** ADMIN+ can edit calendar URLs; FRONT_DESK should escalate. */
  canManageFeeds?: boolean;
  onPropertyChange: (propertyId: string) => void;
  onSyncAll: () => void;
};

function formatFeedSource(source: string): string {
  switch (source) {
    case "BOOKING_COM":
      return "Booking.com";
    case "AIRBNB":
      return "Airbnb";
    case "AGODA":
      return "Agoda";
    default:
      return source;
  }
}

export function DashboardToolbar({
  propertyId,
  properties,
  propertiesLoading,
  date,
  syncPending,
  icalFeedHealth,
  canManageFeeds = false,
  onPropertyChange,
  onSyncAll,
}: DashboardToolbarProps) {
  const { t } = useTranslation("dashboard");
  const failingCount = icalFeedHealth?.failingCount ?? 0;
  const sample = icalFeedHealth?.feeds[0];
  const calendarsHref = propertyId
    ? `/properties/${propertyId}`
    : "/properties";
  const escalateHint = canManageFeeds
    ? t("dashboard:toolbar.escalateOpenCalendars")
    : t("dashboard:toolbar.escalateAskAdmin");

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">
          {t("dashboard:toolbar.title")}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {date
            ? formatDashboardTodayLabel(date)
            : t("dashboard:toolbar.subtitle")}
        </p>
        {failingCount > 0 && (
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            <Link
              to={calendarsHref}
              className="underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-50"
            >
              {failingCount === 1 && sample
                ? t("dashboard:toolbar.otaFailingOne", {
                    unitCode: sample.unitCode,
                    source: formatFeedSource(sample.source),
                  })
                : t("dashboard:toolbar.otaFailingMany", {
                    count: failingCount,
                  })}
            </Link>
            {" — "}
            {escalateHint}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Select
          value={propertyId || undefined}
          onValueChange={onPropertyChange}
          disabled={propertiesLoading || properties.length === 0}
        >
          <SelectTrigger
            className="h-9 w-full min-w-44 sm:w-56"
            aria-label={t("dashboard:toolbar.propertyAriaLabel")}
          >
            <SelectValue
              placeholder={t("dashboard:toolbar.selectPropertyPlaceholder")}
            />
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
          disabled={syncPending}
          onClick={onSyncAll}
        >
          <RefreshCwIcon
            data-icon="inline-start"
            className={syncPending ? "animate-spin" : undefined}
          />
          {t("dashboard:toolbar.syncAll")}
        </Button>
      </div>
    </header>
  );
}
