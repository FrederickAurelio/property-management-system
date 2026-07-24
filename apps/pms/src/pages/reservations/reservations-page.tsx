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
import { cn } from "@/lib/utils";
import { ReservationBadge, SourceBadge } from "./reservation-badges";
import { parseBoard, boardFilterLocks } from "./reservation-boards";
import { ReservationFiltersBar } from "./reservation-filters-bar";
import { ReservationFormDialog } from "./reservation-form-dialog";
import { reservationListStateFromSearch } from "./reservation-nav";
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
          openMoney.kind === "refund" &&
            "text-amber-800 dark:text-amber-200",
          (openMoney.kind === "settled" || openMoney.kind === "closed") &&
            "text-muted-foreground",
        )}
      >
        {openMoney.text}
      </TableCell>
      <TableCell>
        {row.icalSyncWarning && (
          <span
            className="inline-flex text-amber-700 dark:text-amber-300"
            title={formatIcalWarning(row.icalSyncWarning)}
          >
            <AlertTriangleIcon className="size-4" aria-hidden />
            <span className="sr-only">
              {formatIcalWarning(row.icalSyncWarning)}
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
            <span className="truncate text-sm font-medium">{row.guestName}</span>
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
            {formatStayRange(row.checkInDate, row.checkOutDate, row.billingPeriod)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {row.icalSyncWarning && (
            <AlertTriangleIcon
              className="size-4 text-amber-700 dark:text-amber-300"
              aria-label={formatIcalWarning(row.icalSyncWarning)}
            />
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
            openMoney.kind === "refund" &&
              "text-amber-800 dark:text-amber-200",
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
  const sort =
    searchParams.get("sort") === ReservationListSort.createdAt
      ? ReservationListSort.createdAt
      : ReservationListSort.checkIn;
  const q = searchParams.get("q") ?? "";

  useEffect(() => {
    if (!filterLocks.locksStatus || !searchParams.has("status")) {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("status");
        return next;
      },
      { replace: true },
    );
  }, [filterLocks.locksStatus, searchParams, setSearchParams]);

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            // Board "all" is a real preset — keep it in the URL.
            // Status/source/property "all" means clear that filter.
            if (key === "board") {
              if (value == null || value === "") {
                next.delete(key);
              } else {
                next.set(key, value);
              }
              const nextBoard = parseBoard(value);
              if (boardFilterLocks(nextBoard).locksStatus) {
                next.delete("status");
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
      ...(sort === ReservationListSort.createdAt
        ? { sort: ReservationListSort.createdAt }
        : {}),
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
  ]);

  const propertiesQuery = useQuery({
    queryKey: staffPropertiesOptionsQueryKey(),
    queryFn: async () => {
      try {
        return await listPropertyOptions();
      } catch {
        return [];
      }
    },
  });

  const propertyOptions = propertiesQuery.data ?? [];

  const listQuery = useInfiniteQuery({
    queryKey: staffReservationsQueryKey(listFilters),
    queryFn: ({ pageParam }) =>
      listReservations({ ...listFilters, page: pageParam }),
    initialPageParam: INFINITE_INITIAL_PAGE,
    getNextPageParam: getNextPageParamFromPageInfo,
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
          <h1 className="text-lg font-semibold tracking-tight">Reservations</h1>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            Desk boards — status, source, and money always visible.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <PlusIcon data-icon="inline-start" />
          New reservation
        </Button>
      </div>

      <ReservationFiltersBar
        board={board}
        propertyId={propertyId}
        statusFilter={statusFilter}
        sourceFilter={sourceFilter}
        sort={sort}
        showStatusFilter={!filterLocks.locksStatus}
        q={q}
        propertyOptions={propertyOptions}
        onPatch={patchParams}
      />

      {listQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {listQuery.isError && !listQuery.data && (
        <QueryErrorPanel
          message={
            listQuery.error instanceof ApiError && listQuery.error.message
              ? listQuery.error.message.includes(
                  "does not exist in the current database",
                )
                ? "Database is out of date — run prisma migrate, then restart the API."
                : listQuery.error.message.split("\n")[0] ||
                  "Couldn’t load reservations. Try again."
              : "Couldn’t load reservations. Try again."
          }
          onRetry={() => {
            void listQuery.refetch();
          }}
          isRetrying={listQuery.isFetching}
        />
      )}

      {listQuery.data && items.length === 0 && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>No reservations on this board</EmptyTitle>
            <EmptyDescription>
              Try another board or clear filters. Create a walk-in to get
              started.
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
                    <TableHead>Guest</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead title="Stay quote">Total</TableHead>
                    <TableHead title="Cash received so far">Paid</TableHead>
                    <TableHead title="Guest owes, or Refund if overpaid">
                      Due
                    </TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Warning</span>
                    </TableHead>
                    <TableHead className="w-0 p-0">
                      <span className="sr-only">Open</span>
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
                            aria-label={`Open reservation for ${row.guestName}`}
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
