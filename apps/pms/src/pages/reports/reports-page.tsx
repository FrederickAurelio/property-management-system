/* anchor: Stripe-data period review, diverge: cash Net hero; dense analysis tables */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { QueryErrorPanel } from "@/components/query-error-panel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getStaffReportsSummary,
  handleSuccess,
  listPropertyOptions,
  staffPropertiesOptionsQueryKey,
  staffReportsSummaryQueryKey,
} from "@/lib/api";
import { readLastPropertyId, writeLastPropertyId } from "@/lib/last-property";
import { opsTodayYmd, resolvePropertyTimezone } from "@/lib/ops-date";
import { ReportsCashSection } from "./reports-cash-section";
import { downloadReportsCsv } from "./reports-export";
import { ReportsFilterBar } from "./reports-filter-bar";
import { ReportsOccupancySection } from "./reports-occupancy-section";
import {
  activePresetId,
  defaultMonthToDate,
  formatInclusiveRangeLabel,
  previousEqualPeriod,
  rangeForPreset,
} from "./reports-period";
import { ReportsSourceMixSection } from "./reports-source-mix-section";

function ReportsPageSkeleton() {
  return (
    <div className="flex flex-col gap-8 pt-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

export function ReportsPage() {
  const { t } = useTranslation(["reports", "common"]);
  const [searchParams, setSearchParams] = useSearchParams();

  const propertyId = searchParams.get("propertyId") ?? "";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const compareParam = searchParams.get("compare");

  const optionsQuery = useQuery({
    queryKey: staffPropertiesOptionsQueryKey(),
    queryFn: listPropertyOptions,
  });

  const timezone = useMemo(
    () => resolvePropertyTimezone(optionsQuery.data ?? [], propertyId),
    [optionsQuery.data, propertyId],
  );
  const today = useMemo(() => opsTodayYmd(timezone), [timezone]);
  const defaults = useMemo(() => defaultMonthToDate(today), [today]);
  const prevTodayRef = useRef(today);

  const from =
    fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)
      ? fromParam
      : defaults.from;
  const to =
    toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : defaults.to;
  const rangeOk = from <= to;
  const compare = compareParam !== "0";

  const setChrome = useCallback(
    (next: {
      propertyId?: string;
      from?: string;
      to?: string;
      compare?: boolean;
    }) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          const pid = next.propertyId ?? p.get("propertyId") ?? "";
          const nextFrom = next.from ?? p.get("from") ?? defaults.from;
          const nextTo = next.to ?? p.get("to") ?? defaults.to;
          const nextCompare = next.compare ?? p.get("compare") !== "0";
          if (pid) p.set("propertyId", pid);
          else p.delete("propertyId");
          p.set("from", nextFrom);
          p.set("to", nextTo);
          p.set("compare", nextCompare ? "1" : "0");
          return p;
        },
        { replace: true },
      );
    },
    [defaults.from, defaults.to, setSearchParams],
  );

  // URL hygiene: fill missing period defaults, ensure propertyId, re-seed presets when TZ resolves.
  useEffect(() => {
    const needsPeriodDefaults = !fromParam || !toParam || compareParam == null;

    // Wait for property options so period defaults use the resolved property TZ,
    // not the Jakarta fallback from an empty options list.
    if (!optionsQuery.isSuccess || optionsQuery.data.length === 0) {
      return;
    }

    const propertyOk =
      Boolean(propertyId) && optionsQuery.data.some((p) => p.id === propertyId);

    const prevToday = prevTodayRef.current;
    const todayChanged = prevToday !== today;

    if (propertyOk) {
      writeLastPropertyId(propertyId);

      if (needsPeriodDefaults) {
        setChrome({ from: defaults.from, to: defaults.to, compare });
        prevTodayRef.current = today;
        return;
      }

      if (todayChanged) {
        const preset = activePresetId(from, to, prevToday);
        if (preset) {
          const r = rangeForPreset(preset, today);
          setChrome({ from: r.from, to: r.to });
        }
        prevTodayRef.current = today;
      }
      return;
    }

    const preferred = readLastPropertyId();
    const match = optionsQuery.data.find((p) => p.id === preferred);
    const nextId = match?.id ?? optionsQuery.data[0]!.id;
    setChrome({
      propertyId: nextId,
      from: needsPeriodDefaults ? defaults.from : from,
      to: needsPeriodDefaults ? defaults.to : to,
      compare,
    });
    prevTodayRef.current = today;
  }, [
    optionsQuery.isSuccess,
    optionsQuery.data,
    propertyId,
    fromParam,
    toParam,
    compareParam,
    from,
    to,
    compare,
    today,
    defaults.from,
    defaults.to,
    setChrome,
  ]);

  const summaryQuery = useQuery({
    queryKey: staffReportsSummaryQueryKey({
      propertyId,
      from,
      to,
      compare,
    }),
    queryFn: () =>
      getStaffReportsSummary({
        propertyId,
        from,
        to,
        compare,
      }),
    enabled: Boolean(propertyId) && rangeOk,
  });

  const propertyName =
    optionsQuery.data?.find((p) => p.id === propertyId)?.name ??
    t("reports:filterBar.propertyPlaceholder");

  const compareWindow = useMemo(() => {
    if (!compare) return null;
    if (summaryQuery.data?.compare) return summaryQuery.data.compare;
    return previousEqualPeriod(from, to);
  }, [compare, summaryQuery.data?.compare, from, to]);

  const onExport = () => {
    if (!summaryQuery.data) return;
    downloadReportsCsv(summaryQuery.data, {
      compare,
      propertyName,
    });
    handleSuccess(t("reports:page.toastDownloaded"));
  };

  const noProperties = optionsQuery.isSuccess && optionsQuery.data.length === 0;

  const handlePropertyChange = (id: string) => {
    const preset = activePresetId(from, to, today);
    if (preset) {
      const newTz = resolvePropertyTimezone(optionsQuery.data ?? [], id);
      const newToday = opsTodayYmd(newTz);
      const r = rangeForPreset(preset, newToday);
      setChrome({ propertyId: id, from: r.from, to: r.to });
      return;
    }
    setChrome({ propertyId: id });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-0 p-4 pb-20 md:p-5 md:pb-8">
      <ReportsFilterBar
        propertyId={propertyId}
        properties={optionsQuery.data ?? []}
        propertiesLoading={optionsQuery.isPending}
        today={today}
        timezone={timezone}
        from={from}
        to={to}
        compare={compare}
        compareWindow={compareWindow}
        exportDisabled={!summaryQuery.data || summaryQuery.isFetching}
        onPropertyChange={handlePropertyChange}
        onFromChange={(nextFrom) => {
          const nextTo = nextFrom > to ? nextFrom : to;
          setChrome({ from: nextFrom, to: nextTo });
        }}
        onToChange={(nextTo) => {
          const nextFrom = nextTo < from ? nextTo : from;
          setChrome({ from: nextFrom, to: nextTo });
        }}
        onRangeChange={(nextFrom, nextTo) => {
          setChrome({ from: nextFrom, to: nextTo });
        }}
        onCompareChange={(next) => {
          setChrome({ compare: next });
        }}
        onExport={onExport}
      />

      {noProperties && (
        <p className="pt-8 text-sm text-muted-foreground">
          {t("reports:page.addPropertyFirst")}
        </p>
      )}

      {!noProperties && !propertyId && (
        <p className="pt-8 text-sm text-muted-foreground">
          {t("reports:page.selectProperty")}
        </p>
      )}

      {propertyId && !rangeOk && (
        <p className="pt-8 text-sm text-muted-foreground">
          {t("reports:page.invalidRange")}
        </p>
      )}

      {propertyId && rangeOk && summaryQuery.isPending && (
        <ReportsPageSkeleton />
      )}

      {propertyId && rangeOk && summaryQuery.isError && (
        <div className="pt-6">
          <QueryErrorPanel
            message={t("reports:page.loadError")}
            onRetry={() => {
              void summaryQuery.refetch();
            }}
            isRetrying={summaryQuery.isFetching}
          />
        </div>
      )}

      {propertyId && rangeOk && summaryQuery.data && (
        <div className="flex flex-col gap-6 pt-4 md:gap-5 md:pt-4">
          <header className="flex flex-col gap-0.5 md:hidden">
            <h1 className="text-lg font-semibold tracking-tight">
              {propertyName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatInclusiveRangeLabel(from, to)}
            </p>
          </header>

          <ReportsCashSection cash={summaryQuery.data.cash} compare={compare} />
          <ReportsOccupancySection
            occupancy={summaryQuery.data.occupancy}
            byUnitType={summaryQuery.data.occupancyByUnitType}
            compare={compare}
          />
          <ReportsSourceMixSection
            rows={summaryQuery.data.sourceMix}
            cashBySource={summaryQuery.data.cash.bySource}
            periodCashNet={summaryQuery.data.cash.netIdr}
            compare={compare}
          />

          <p className="border-t border-border pt-3 text-xs text-muted-foreground md:pt-4 md:text-sm">
            {t("reports:page.footerNote")}
          </p>
        </div>
      )}
    </div>
  );
}
