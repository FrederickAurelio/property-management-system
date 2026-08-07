/* anchor: Linear issues home / Stripe desk, diverge: Today title; bordered Arrivals|Departures + Needs; no KPI strip */
import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GaugeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { QueryErrorPanel } from "@/components/query-error-panel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getStaffDashboard,
  handleError,
  handleSuccess,
  invalidateIcalSyncCaches,
  listPropertyOptions,
  staffDashboardQueryKey,
  staffPropertiesOptionsQueryKey,
  staffSession,
  staffSessionQueryKey,
  syncAllIcalFeeds,
} from "@/lib/api";
import { canManageInventory } from "@/lib/staff-permissions";
import { DashboardNeedsSection } from "./dashboard-needs-section";
import { DashboardStayList } from "./dashboard-row";
import { DashboardPanel } from "./dashboard-section";
import { reservationsBoardHref } from "./dashboard-format";
import { DashboardToolbar } from "./dashboard-toolbar";
import { readLastPropertyId, writeLastPropertyId } from "@/lib/last-property";

function DashboardPageSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyId = searchParams.get("propertyId") ?? "";
  const dashboardSearch = searchParams.toString()
    ? `?${searchParams.toString()}`
    : "";

  const setPropertyId = useCallback(
    (nextId: string) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (nextId) p.set("propertyId", nextId);
          else p.delete("propertyId");
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const queryClient = useQueryClient();

  const optionsQuery = useQuery({
    queryKey: staffPropertiesOptionsQueryKey(),
    queryFn: listPropertyOptions,
  });

  const sessionQuery = useQuery({
    queryKey: staffSessionQueryKey,
    queryFn: () => staffSession(),
  });

  const canManageFeeds = sessionQuery.data
    ? canManageInventory(sessionQuery.data.role)
    : false;

  useEffect(() => {
    if (!optionsQuery.isSuccess || optionsQuery.data.length === 0) return;
    if (propertyId && optionsQuery.data.some((p) => p.id === propertyId)) {
      writeLastPropertyId(propertyId);
      return;
    }
    const preferred = readLastPropertyId();
    const match = optionsQuery.data.find((p) => p.id === preferred);
    const nextId = match?.id ?? optionsQuery.data[0]!.id;
    setPropertyId(nextId);
  }, [optionsQuery.isSuccess, optionsQuery.data, propertyId, setPropertyId]);

  const dashboardQuery = useQuery({
    queryKey: staffDashboardQueryKey({ propertyId }),
    queryFn: () => getStaffDashboard({ propertyId }),
    enabled: Boolean(propertyId),
  });

  const syncMutation = useMutation({
    mutationFn: syncAllIcalFeeds,
    onSuccess: (result) => {
      invalidateIcalSyncCaches(queryClient);
      if (result.feedsAttempted === 0) {
        handleSuccess(t("dashboard:sync.noneActive"));
        return;
      }
      if (result.feedsFailed > 0) {
        handleSuccess(
          t("dashboard:sync.partial", {
            ok: result.feedsOk,
            attempted: result.feedsAttempted,
            failed: result.feedsFailed,
          }),
        );
        return;
      }
      handleSuccess(t("dashboard:sync.ok", { count: result.feedsOk }));
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const noProperties = optionsQuery.isSuccess && optionsQuery.data.length === 0;

  const onSyncAll = () => {
    syncMutation.mutate();
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-20 md:gap-5 md:p-6 md:pb-8">
      <DashboardToolbar
        propertyId={propertyId}
        properties={optionsQuery.data ?? []}
        propertiesLoading={optionsQuery.isPending}
        date={dashboardQuery.data?.date ?? null}
        syncPending={syncMutation.isPending}
        icalFeedHealth={dashboardQuery.data?.icalFeedHealth ?? null}
        canManageFeeds={canManageFeeds}
        onPropertyChange={setPropertyId}
        onSyncAll={onSyncAll}
      />

      {noProperties && (
        <p className="text-sm text-muted-foreground">
          {t("dashboard:noProperties")}
        </p>
      )}

      {!noProperties && !propertyId && optionsQuery.isPending && (
        <DashboardPageSkeleton />
      )}

      {propertyId && dashboardQuery.isPending && <DashboardPageSkeleton />}

      {propertyId && dashboardQuery.isError && (
        <QueryErrorPanel
          message={t("dashboard:loadError")}
          onRetry={() => {
            void dashboardQuery.refetch();
          }}
          isRetrying={dashboardQuery.isFetching}
        />
      )}

      {dashboardQuery.data && (
        <div className="flex flex-col gap-4">
          <div className="grid items-start gap-4 md:grid-cols-2">
            <DashboardPanel
              title={t("dashboard:arrivals.title")}
              total={dashboardQuery.data.arrivals.total}
              viewAllHref={
                dashboardQuery.data.arrivals.total > 0
                  ? reservationsBoardHref("arrivals", propertyId)
                  : null
              }
              isEmpty={dashboardQuery.data.arrivals.total === 0}
              emptyMessage={t("dashboard:arrivals.empty")}
            >
              <DashboardStayList
                items={dashboardQuery.data.arrivals.items}
                opsDate={dashboardQuery.data.date}
                dashboardSearch={dashboardSearch}
              />
            </DashboardPanel>

            <DashboardPanel
              title={t("dashboard:departures.title")}
              total={dashboardQuery.data.departures.total}
              viewAllHref={
                dashboardQuery.data.departures.total > 0
                  ? reservationsBoardHref("departures", propertyId)
                  : null
              }
              isEmpty={dashboardQuery.data.departures.total === 0}
              emptyMessage={t("dashboard:departures.empty")}
            >
              <DashboardStayList
                items={dashboardQuery.data.departures.items}
                opsDate={dashboardQuery.data.date}
                dashboardSearch={dashboardSearch}
              />
            </DashboardPanel>
          </div>

          <DashboardNeedsSection
            total={dashboardQuery.data.needsAttention.total}
            items={dashboardQuery.data.needsAttention.items}
            propertyId={propertyId}
            opsDate={dashboardQuery.data.date}
            dashboardSearch={dashboardSearch}
          />

          {dashboardQuery.data.utilitiesDue &&
            dashboardQuery.data.utilitiesDue.total > 0 && (
              <Link
                to={reservationsBoardHref("utilities-due", propertyId)}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <GaugeIcon
                    data-icon="inline-start"
                    className="size-4 shrink-0 text-amber-700 dark:text-amber-300"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {t("dashboard:utilitiesDue.title", {
                        count: dashboardQuery.data.utilitiesDue.total,
                      })}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t("dashboard:utilitiesDue.description")}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium text-foreground tabular-nums">
                  {dashboardQuery.data.utilitiesDue.total}
                </span>
              </Link>
            )}
        </div>
      )}
    </div>
  );
}
