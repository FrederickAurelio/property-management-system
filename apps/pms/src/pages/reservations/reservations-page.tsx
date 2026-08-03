/* anchor: Linear-dense / Stripe-data ops list, diverge: board tabs + money columns */
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ReservationListSort,
  ReservationSource,
  ReservationStatus,
  type StaffReservationListItem,
} from "@cabin/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { InfiniteListFooter } from "@/components/infinite-list-footer";
import { QueryErrorPanel } from "@/components/query-error-panel";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getNextPageParamFromPageInfo,
  INFINITE_INITIAL_PAGE,
  listPropertyOptions,
  listReservations,
  staffPropertiesOptionsQueryKey,
  staffReservationsQueryKey,
  type StaffReservationsListFilters,
  ApiError,
} from "@/lib/api";
import { readLastPropertyId, writeLastPropertyId } from "@/lib/last-property";
import { cn } from "@/lib/utils";
import { ReservationBadge, SourceBadge } from "./reservation-badges";
import { parseBoard, boardFilterLocks, parseReservationListSort } from "./reservation-boards";
import { ReservationFiltersBar } from "./reservation-filters-bar";
import { ReservationFormDialog } from "./reservation-form-dialog";
import { reservationListStateFromSearch } from "./reservation-nav";
import { parseStayTouchRange } from "./reservation-stay-range";
import {
  formatIcalWarning,
  formatMoneyOrDash,
  formatReservationBalanceCell,
  formatReservationLateCue,
  formatReservationSource,
  formatReservationStatus,
  formatStayRange,
  reservationLateCue,
  statusBadgeTone,
  type ReservationLateCue,
} from "./reservation-format";

const ReservationRowCells = memo(function ReservationRowCells({
  row,
  lateCue,
}: {
  row: StaffReservationListItem;
  lateCue: ReservationLateCue | null;
}) {
  const openMoney = formatReservationBalanceCell(row);
  return (
    <>
      <TableCell className="min-w-0 font-medium">
        <span className="inline-flex max-w-full items-center gap-1.5">
          <span className="truncate">{row.guestName}</span>
          {lateCue ? (
            <ReservationBadge
              label={formatReservationLateCue(lateCue)}
              tone="warn"
              className="shrink-0"
            />
          ) : null}
        </span>
      </TableCell>
      <TableCell className="tabular-nums">{row.unitCode}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatStayRange(row.checkInDate, row.checkOutDate, row.billingPeriod)}
      </TableCell>
      <TableCell>
        <ReservationBadge
          label={formatReservationStatus(row.status)}
          tone={statusBadgeTone(row.status)}
        />
      </TableCell>
      <TableCell>
        <SourceBadge
          source={row.source}
          label={formatReservationSource(row.source)}
        />
      </TableCell>
      <TableCell className="tabular-nums">
        {formatMoneyOrDash(row.totalAmountIdr)}
      </TableCell>
      <TableCell className="tabular-nums">
        {formatMoneyOrDash(row.paidAmountIdr)}
      </TableCell>
      <TableCell
        className={cn(
          "tabular-nums",
          openMoney.kind === "refund" && "text-amber-800 dark:text-amber-200",
          (openMoney.kind === "settled" || openMoney.kind === "closed") &&
            "text-muted-foreground",
        )}
      >
        {openMoney.text}
      </TableCell>
      <TableCell>
        {row.icalSyncWarning && (
          <span
            className="inline-flex max-w-[11rem] items-center gap-1 text-amber-800 dark:text-amber-200"
            title={formatIcalWarning(row.icalSyncWarning, row.source)}
          >
            <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate text-xs">
              {formatIcalWarning(row.icalSyncWarning, row.source)}
            </span>
          </span>
        )}
      </TableCell>
    </>
  );
});

const ReservationMobileCard = memo(function ReservationMobileCard({
  row,
  listSearch,
  lateCue,
}: {
  row: StaffReservationListItem;
  listSearch: string;
  lateCue: ReservationLateCue | null;
}) {
  const openMoney = formatReservationBalanceCell(row);
  const cancelled = row.status === ReservationStatus.CANCELLED;
  return (
    <Link
      to={`/reservations/${row.id}`}
      state={reservationListStateFromSearch(listSearch)}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/40 active:bg-muted/60",
        cancelled && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="inline-flex max-w-full items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              {row.guestName}
            </span>
            {lateCue ? (
              <ReservationBadge
                label={formatReservationLateCue(lateCue)}
                tone="warn"
                className="shrink-0"
              />
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.unitCode}
            <span className="text-border"> · </span>
            {formatStayRange(
              row.checkInDate,
              row.checkOutDate,
              row.billingPeriod,
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {row.icalSyncWarning && (
            <span className="inline-flex max-w-[9rem] items-center gap-1 text-amber-800 dark:text-amber-200">
              <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate text-[11px] leading-tight">
                {formatIcalWarning(row.icalSyncWarning, row.source)}
              </span>
            </span>
          )}
          <ReservationBadge
            label={formatReservationStatus(row.status)}
            tone={statusBadgeTone(row.status)}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <SourceBadge
          source={row.source}
          label={formatReservationSource(row.source)}
        />
        <p
          className={cn(
            "shrink-0 text-xs tabular-nums",
            openMoney.kind === "refund" && "text-amber-800 dark:text-amber-200",
            (openMoney.kind === "settled" || openMoney.kind === "closed") &&
              "text-muted-foreground",
            openMoney.kind === "due" && "text-foreground",
          )}
        >
          {openMoney.text}
        </p>
      </div>
    </Link>
  );
});

export function ReservationsPage() {
  const { t } = useTranslation(["reservations", "common"]);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [createOpen, setCreateOpen] = useState(false);

  const board = parseBoard(searchParams.get("board"));
  const filterLocks = boardFilterLocks(board);
  const propertyId = searchParams.get("propertyId") ?? "";
  const statusFilter = filterLocks.locksStatus
    ? "all"
    : (searchParams.get("status") ?? "all");
  const sourceFilter = searchParams.get("source") ?? "all";
  const sortParam = searchParams.get("sort");
  const sort = parseReservationListSort(board, sortParam);
  const q = searchParams.get("q") ?? "";
  const stayTouch = filterLocks.showDateRangeFilter
    ? parseStayTouchRange(searchParams.get("from"), searchParams.get("to"))
    : null;
  const from = stayTouch?.from ?? "";
  const to = stayTouch?.to ?? "";

  // Drop URL params the current board does not own (stale deep links / back nav).
  // Needed so locked params cannot "wake up" after switching to a board that allows them
  // (e.g. ?board=arrivals&status=CONFIRMED → All would otherwise keep status).
  useEffect(() => {
    const staleStatus =
      filterLocks.locksStatus && searchParams.has("status");
    const staleDates =
      !filterLocks.showDateRangeFilter &&
      (searchParams.has("from") || searchParams.has("to"));
    const staleOpenAmount =
      board !== "balance-due" &&
      searchParams.get("sort") === ReservationListSort.openAmount;
    if (!staleStatus && !staleDates && !staleOpenAmount) {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (staleStatus) {
          next.delete("status");
        }
        if (staleDates) {
          next.delete("from");
          next.delete("to");
        }
        if (staleOpenAmount) {
          next.delete("sort");
        }
        return next;
      },
      { replace: true },
    );
  }, [
    board,
    filterLocks.locksStatus,
    filterLocks.showDateRangeFilter,
    searchParams,
    setSearchParams,
  ]);

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            // Board "all" is a real preset — keep it in the URL.
            // Status/source "all" means clear that filter.
            // Property is always a concrete id (no “all properties”).
            if (key === "board") {
              const prevBoard = parseBoard(prev.get("board"));
              if (value == null || value === "") {
                next.delete(key);
              } else {
                next.set(key, value);
              }
              const nextBoard = parseBoard(value);
              const nextLocks = boardFilterLocks(nextBoard);
              if (nextLocks.locksStatus) {
                next.delete("status");
              }
              if (!nextLocks.showDateRangeFilter) {
                next.delete("from");
                next.delete("to");
              }
              // Enter Balance due → open amount. Leave it → Stay date.
              // Do not wipe Created when switching among other boards.
              if (nextBoard === "balance-due") {
                next.set("sort", ReservationListSort.openAmount);
              } else if (prevBoard === "balance-due") {
                next.delete("sort");
              }
              continue;
            }
            if (value == null || value === "" || value === "all") {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const listFilters = useMemo((): StaffReservationsListFilters => {
    const filters: StaffReservationsListFilters = {
      board,
      ...(propertyId ? { propertyId } : {}),
      ...(q ? { q } : {}),
      ...(sort !== ReservationListSort.checkIn ? { sort } : {}),
      ...(from && to ? { from, to } : {}),
    };
    if (!filterLocks.locksStatus && statusFilter !== "all") {
      filters.status = statusFilter as ReservationStatus;
    }
    if (sourceFilter !== "all") {
      filters.source = sourceFilter as ReservationSource;
    }
    return filters;
  }, [
    board,
    propertyId,
    q,
    sort,
    statusFilter,
    sourceFilter,
    filterLocks.locksStatus,
    from,
    to,
  ]);

  const propertiesQuery = useQuery({
    queryKey: staffPropertiesOptionsQueryKey(),
    queryFn: listPropertyOptions,
  });

  const propertyOptions = propertiesQuery.data ?? [];
  const noProperties =
    propertiesQuery.isSuccess && propertyOptions.length === 0;

  useEffect(() => {
    if (!propertiesQuery.isSuccess || !propertiesQuery.data?.length) {
      return;
    }
    const options = propertiesQuery.data;
    if (propertyId && options.some((p) => p.id === propertyId)) {
      writeLastPropertyId(propertyId);
      return;
    }
    const preferred = readLastPropertyId();
    const match = options.find((p) => p.id === preferred);
    const nextId = match?.id ?? options[0]!.id;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("propertyId", nextId);
        return next;
      },
      { replace: true },
    );
  }, [
    propertiesQuery.isSuccess,
    propertiesQuery.data,
    propertyId,
    setSearchParams,
  ]);

  const listQuery = useInfiniteQuery({
    queryKey: staffReservationsQueryKey(listFilters),
    queryFn: ({ pageParam }) =>
      listReservations({ ...listFilters, page: pageParam }),
    initialPageParam: INFINITE_INITIAL_PAGE,
    getNextPageParam: getNextPageParamFromPageInfo,
    enabled: Boolean(propertyId),
  });

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  );

  const listSearch = location.search;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">
            {t("reservations:list.title")}
          </h1>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t("reservations:list.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={!propertyId}
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <PlusIcon data-icon="inline-start" />
          {t("reservations:list.newReservation")}
        </Button>
      </div>

      <ReservationFiltersBar
        board={board}
        propertyId={propertyId}
        statusFilter={statusFilter}
        sourceFilter={sourceFilter}
        sort={sort}
        showStatusFilter={!filterLocks.locksStatus}
        showDateRangeFilter={filterLocks.showDateRangeFilter}
        from={from}
        to={to}
        q={q}
        propertyOptions={propertyOptions}
        onPatch={patchParams}
      />

      {noProperties && (
        <p className="text-sm text-muted-foreground">
          {t("reservations:list.noProperties")}
        </p>
      )}

      {!noProperties && !propertyId && propertiesQuery.isPending && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {propertyId && listQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {propertyId && listQuery.isError && !listQuery.data && (
        <QueryErrorPanel
          message={
            listQuery.error instanceof ApiError && listQuery.error.message
              ? listQuery.error.message.includes(
                  "does not exist in the current database",
                )
                ? t("reservations:list.errors.migrationNeeded")
                : listQuery.error.message.split("\n")[0] ||
                  t("reservations:list.errors.generic")
              : t("reservations:list.errors.generic")
          }
          onRetry={() => {
            void listQuery.refetch();
          }}
          isRetrying={listQuery.isFetching}
        />
      )}

      {propertyId && listQuery.data && items.length === 0 && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>
              {board === "ical-alerts"
                ? t("reservations:list.empty.icalAlertsTitle")
                : board === "needs-details"
                  ? t("reservations:list.empty.needsDetailsTitle")
                  : t("reservations:list.empty.defaultTitle")}
            </EmptyTitle>
            <EmptyDescription>
              {board === "ical-alerts"
                ? t("reservations:list.empty.icalAlertsDescription")
                : board === "needs-details"
                  ? t("reservations:list.empty.needsDetailsDescription")
                  : t("reservations:list.empty.defaultDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {items.length > 0 && (
        <>
          {isMobile ? (
            <ul className="flex flex-col gap-2">
              {items.map((row) => {
                const lateCue = reservationLateCue(row);
                return (
                  <li key={row.id}>
                    <ReservationMobileCard
                      row={row}
                      listSearch={listSearch}
                      lateCue={lateCue}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reservations:list.table.guest")}</TableHead>
                    <TableHead>{t("reservations:list.table.unit")}</TableHead>
                    <TableHead>{t("reservations:list.table.dates")}</TableHead>
                    <TableHead>{t("reservations:list.table.status")}</TableHead>
                    <TableHead>{t("reservations:list.table.source")}</TableHead>
                    <TableHead title={t("reservations:list.table.totalTitle")}>
                      {t("reservations:list.table.total")}
                    </TableHead>
                    <TableHead title={t("reservations:list.table.paidTitle")}>
                      {t("reservations:list.table.paid")}
                    </TableHead>
                    <TableHead title={t("reservations:list.table.dueTitle")}>
                      {t("reservations:list.table.due")}
                    </TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">
                        {t("reservations:list.table.warningSr")}
                      </span>
                    </TableHead>
                    <TableHead className="w-0 p-0">
                      <span className="sr-only">
                        {t("reservations:list.table.openSr")}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => {
                    const lateCue = reservationLateCue(row);
                    const cancelled =
                      row.status === ReservationStatus.CANCELLED;
                    return (
                      <TableRow
                        key={row.id}
                        className={cn(
                          "relative hover:bg-muted/40",
                          cancelled && "opacity-60",
                        )}
                      >
                        <ReservationRowCells row={row} lateCue={lateCue} />
                        <TableCell className="w-0 p-0">
                          <Link
                            to={`/reservations/${row.id}`}
                            state={reservationListStateFromSearch(listSearch)}
                            className="absolute inset-0"
                            aria-label={t(
                              "reservations:list.openReservationFor",
                              { guest: row.guestName },
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <InfiniteListFooter
            hasNextPage={Boolean(listQuery.hasNextPage)}
            isFetchingNextPage={listQuery.isFetchingNextPage}
            isFetchNextPageError={listQuery.isFetchNextPageError}
            fetchNextPage={() => {
              void listQuery.fetchNextPage();
            }}
          />
        </>
      )}

      {createOpen && (
        <ReservationFormDialog
          open
          onOpenChange={setCreateOpen}
          intent="create"
          initialPropertyId={propertyId}
          initialPropertyName={
            propertyOptions.find((p) => p.id === propertyId)?.name ?? ""
          }
          onCreated={(id) => {
            void navigate(`/reservations/${id}`, {
              state: reservationListStateFromSearch(listSearch),
            });
          }}
        />
      )}
    </div>
  );
}
