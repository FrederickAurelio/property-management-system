/* anchor: Linear-dense / Stripe-data ops list, diverge: board tabs + money columns */
import { memo, useCallback, useMemo, useState } from "react";
import {
  ReservationSource,
  ReservationStatus,
  type StaffReservation,
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
  FIXTURE_PROPERTY_B_ID,
  FIXTURE_PROPERTY_B_NAME,
  FIXTURE_PROPERTY_ID,
  FIXTURE_PROPERTY_NAME,
  getNextPageParamFromPageInfo,
  INFINITE_INITIAL_PAGE,
  listProperties,
  listReservations,
  staffPropertiesOptionsQueryKey,
  staffReservationsQueryKey,
  type StaffReservationsListFilters,
} from "@/lib/api";
import { ReservationBadge, SourceBadge } from "./reservation-badges";
import { parseBoard } from "./reservation-boards";
import { ReservationFiltersBar } from "./reservation-filters-bar";
import { ReservationFormDialog } from "./reservation-form-dialog";
import { reservationListStateFromSearch } from "./reservation-nav";
import {
  formatIcalWarning,
  formatMoneyOrDash,
  formatPaymentStatus,
  formatReservationSource,
  formatReservationStatus,
  formatStayRange,
  paymentBadgeTone,
  reservationBalance,
  statusBadgeTone,
} from "./reservation-format";

const ReservationRowCells = memo(function ReservationRowCells({
  row,
}: {
  row: StaffReservation;
}) {
  const balance = reservationBalance(row);
  return (
    <>
      <TableCell className="min-w-0 font-medium">
        <span className="truncate">{row.guestName}</span>
      </TableCell>
      <TableCell className="tabular-nums">{row.unitCode}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatStayRange(row.checkInDate, row.checkOutDate)}
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
      <TableCell className="tabular-nums">
        <span className="inline-flex flex-col gap-1">
          <span
            className={
              balance.kind === "refund"
                ? "text-amber-800 dark:text-amber-200"
                : undefined
            }
          >
            {balance.kind === "refund" ? "Refund " : null}
            {formatMoneyOrDash(balance.amount)}
          </span>
          <ReservationBadge
            label={formatPaymentStatus(row.paymentStatus)}
            tone={paymentBadgeTone(row.paymentStatus)}
            className="w-fit"
          />
        </span>
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
}: {
  row: StaffReservation;
  listSearch: string;
}) {
  const balance = reservationBalance(row);
  return (
    <Link
      to={`/reservations/${row.id}`}
      state={reservationListStateFromSearch(listSearch)}
      className="flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/40 active:bg-muted/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.guestName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.unitCode}
            <span className="text-border"> · </span>
            {formatStayRange(row.checkInDate, row.checkOutDate)}
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
        <div className="flex min-w-0 flex-wrap gap-1">
          <SourceBadge
            source={row.source}
            label={formatReservationSource(row.source)}
          />
          <ReservationBadge
            label={formatPaymentStatus(row.paymentStatus)}
            tone={paymentBadgeTone(row.paymentStatus)}
          />
        </div>
        <p
          className={`shrink-0 text-xs tabular-nums ${
            balance.kind === "refund"
              ? "text-amber-800 dark:text-amber-200"
              : "text-muted-foreground"
          }`}
        >
          {balance.kind === "refund" ? "Refund " : "Due "}
          {formatMoneyOrDash(balance.amount)}
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
  const propertyId = searchParams.get("propertyId") ?? "";
  const statusFilter = searchParams.get("status") ?? "all";
  const sourceFilter = searchParams.get("source") ?? "all";
  const q = searchParams.get("q") ?? "";

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
    };
    if (statusFilter !== "all") {
      filters.status = statusFilter as ReservationStatus;
    }
    if (sourceFilter !== "all") {
      filters.source = sourceFilter as ReservationSource;
    }
    return filters;
  }, [board, propertyId, q, statusFilter, sourceFilter]);

  const propertiesQuery = useQuery({
    queryKey: staffPropertiesOptionsQueryKey(),
    queryFn: async () => {
      try {
        const page = await listProperties({ pageSize: 100 });
        return page.items;
      } catch {
        return [];
      }
    },
  });

  const propertyOptions = useMemo(() => {
    const live = (propertiesQuery.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
    }));
    if (live.length > 0) {
      return live;
    }
    return [
      { id: FIXTURE_PROPERTY_ID, name: FIXTURE_PROPERTY_NAME },
      { id: FIXTURE_PROPERTY_B_ID, name: FIXTURE_PROPERTY_B_NAME },
    ];
  }, [propertiesQuery.data]);

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
          message="Couldn’t load reservations. Try again."
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
              {items.map((row) => (
                <li key={row.id}>
                  <ReservationMobileCard row={row} listSearch={listSearch} />
                </li>
              ))}
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
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Warning</span>
                    </TableHead>
                    <TableHead className="w-0 p-0">
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow
                      key={row.id}
                      className="relative hover:bg-muted/40"
                    >
                      <ReservationRowCells row={row} />
                      <TableCell className="w-0 p-0">
                        <Link
                          to={`/reservations/${row.id}`}
                          state={reservationListStateFromSearch(listSearch)}
                          className="absolute inset-0"
                          aria-label={`Open reservation for ${row.guestName}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
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
