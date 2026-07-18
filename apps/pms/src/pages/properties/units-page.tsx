/* anchor: Linear-dense explorer, diverge: units under a type */
import { useMemo, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  UnitStatus,
  type StaffUnit,
  type UnitStatus as UnitStatusType,
} from "@cabin/api-contract";
import { DoorOpenIcon } from "lucide-react";
import { InfiniteListFooter } from "@/components/infinite-list-footer";
import { QueryRetryButton } from "@/components/query-retry-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  deleteUnit,
  getNextPageParamFromPageInfo,
  getProperty,
  getUnitType,
  handleError,
  handleSuccess,
  INFINITE_INITIAL_PAGE,
  listUnits,
  staffPropertiesQueryKeyPrefix,
  staffPropertyQueryKey,
  staffUnitsQueryKey,
  staffUnitsQueryKeyPrefix,
  staffUnitTypeQueryKey,
} from "@/lib/api";
import {
  ExplorerGrid,
  ExplorerItem,
  StatusBadge,
} from "@/components/explorer/explorer-item";
import { useExplorerSearchParams } from "@/components/explorer/explorer-params";
import { ExplorerToolbar } from "./explorer-toolbar";
import {
  findStaffPropertyName,
  findStaffUnitTypeName,
  parseExplorerNavState,
} from "./explorer-nav-state";
import { useInventoryAccess } from "./inventory-access";
import { formatUnitStatus } from "./inventory-types";
import { UnitFormDialog } from "./unit-form-dialog";

function parseUnitStatus(value: string): UnitStatusType | undefined {
  if (
    value === UnitStatus.ACTIVE ||
    value === UnitStatus.INACTIVE ||
    value === UnitStatus.MAINTENANCE
  ) {
    return value;
  }
  return undefined;
}

export function UnitsPage() {
  const { propertyId = "", unitTypeId = "" } = useParams();
  const location = useLocation();
  const { canManage } = useInventoryAccess();
  const { q, view, status } = useExplorerSearchParams();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffUnit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffUnit | null>(null);

  const navState = useMemo(
    () => parseExplorerNavState(location.state),
    [location.state],
  );
  const propertyNameHint = useMemo(
    () =>
      navState.propertyName ??
      (propertyId
        ? findStaffPropertyName(queryClient, propertyId)
        : undefined),
    [navState.propertyName, propertyId, queryClient],
  );
  const unitTypeNameHint = useMemo(
    () =>
      navState.unitTypeName ??
      (unitTypeId
        ? findStaffUnitTypeName(queryClient, unitTypeId)
        : undefined),
    [navState.unitTypeName, unitTypeId, queryClient],
  );

  const propertyQuery = useQuery({
    queryKey: staffPropertyQueryKey(propertyId),
    queryFn: () => getProperty(propertyId),
    enabled: Boolean(propertyId) && !propertyNameHint,
  });

  const unitTypeQuery = useQuery({
    queryKey: staffUnitTypeQueryKey(unitTypeId),
    queryFn: () => getUnitType(unitTypeId),
    enabled: Boolean(unitTypeId) && !unitTypeNameHint,
  });

  const propertyReady =
    Boolean(propertyNameHint) || propertyQuery.isSuccess;
  const unitTypeReady =
    Boolean(unitTypeNameHint) || unitTypeQuery.isSuccess;
  const unitTypeName =
    unitTypeQuery.data?.name ?? unitTypeNameHint ?? "…";

  const statusFilter = parseUnitStatus(status);
  const listFilters = useMemo(
    () => ({
      q: q.trim() || undefined,
      unitTypeId,
      status: statusFilter,
    }),
    [q, unitTypeId, statusFilter],
  );

  const parentsReady = propertyReady && unitTypeReady;

  const listQuery = useInfiniteQuery({
    queryKey: staffUnitsQueryKey(propertyId, listFilters),
    queryFn: ({ pageParam }) =>
      listUnits(propertyId, {
        page: pageParam,
        q: listFilters.q,
        unitTypeId: listFilters.unitTypeId,
        status: listFilters.status,
      }),
    initialPageParam: INFINITE_INITIAL_PAGE,
    getNextPageParam: getNextPageParamFromPageInfo,
    enabled: parentsReady,
  });

  const deleteMutation = useMutation({
    mutationFn: (input: { id: string; code: string }) => deleteUnit(input.id),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: staffUnitsQueryKeyPrefix,
      });
      void queryClient.invalidateQueries({
        queryKey: staffUnitTypeQueryKey(unitTypeId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffPropertyQueryKey(propertyId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffPropertiesQueryKeyPrefix,
      });
      handleSuccess(`Deleted ${variables.code}`);
      setDeleteTarget(null);
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data],
  );

  const parentNotFound =
    (!propertyNameHint &&
      propertyQuery.isError &&
      propertyQuery.error instanceof ApiError &&
      propertyQuery.error.status === 404) ||
    (!unitTypeNameHint &&
      unitTypeQuery.isError &&
      unitTypeQuery.error instanceof ApiError &&
      unitTypeQuery.error.status === 404);

  if (parentNotFound) {
    return <Navigate to="/properties" replace />;
  }

  if (
    unitTypeQuery.isSuccess &&
    unitTypeQuery.data.propertyId !== propertyId
  ) {
    return <Navigate to="/properties" replace />;
  }

  if (
    (!propertyNameHint && propertyQuery.isPending) ||
    (!unitTypeNameHint && unitTypeQuery.isPending)
  ) {
    return (
      <>
        <ExplorerToolbar
          layer="units"
          createLabel="Add unit"
          canManage={false}
          onCreate={() => undefined}
        />
        <ExplorerGrid view={view}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </ExplorerGrid>
      </>
    );
  }

  if (
    (!propertyNameHint && propertyQuery.isError) ||
    (!unitTypeNameHint && unitTypeQuery.isError)
  ) {
    return (
      <>
        <ExplorerToolbar
          layer="units"
          createLabel="Add unit"
          canManage={false}
          onCreate={() => undefined}
        />
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border px-4 py-6">
          <p className="text-sm text-muted-foreground">
            Couldn’t load this page. Check your connection and try again.
          </p>
          <QueryRetryButton
            onRetry={() => {
              if (propertyQuery.isError) {
                void propertyQuery.refetch();
              }
              if (unitTypeQuery.isError) {
                void unitTypeQuery.refetch();
              }
            }}
            isRetrying={propertyQuery.isFetching || unitTypeQuery.isFetching}
          />
        </div>
      </>
    );
  }

  function openCreate() {
    if (!canManage) {
      return;
    }
    setEditTarget(null);
    setFormOpen(true);
  }

  return (
    <>
      <ExplorerToolbar
        layer="units"
        createLabel="Add unit"
        canManage={canManage}
        onCreate={openCreate}
      />

      {listQuery.isPending && (
        <ExplorerGrid view={view}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </ExplorerGrid>
      )}

      {listQuery.isError && !listQuery.data && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border px-4 py-6">
          <p className="text-sm text-muted-foreground">
            Couldn’t load units. Check your connection and try again.
          </p>
          <QueryRetryButton
            onRetry={() => {
              void listQuery.refetch();
            }}
            isRetrying={listQuery.isFetching}
          />
        </div>
      )}

      {listQuery.data && items.length === 0 && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DoorOpenIcon />
            </EmptyMedia>
            <EmptyTitle>
              {q || status !== "all" ? "No matching units" : "No units yet"}
            </EmptyTitle>
            <EmptyDescription>
              {q || status !== "all"
                ? "Try a different search or status filter."
                : `Add physical units for ${unitTypeName}. Each gets its own calendar.`}
            </EmptyDescription>
          </EmptyHeader>
          {!q && status === "all" && canManage && (
            <EmptyContent>
              <Button type="button" size="sm" onClick={openCreate}>
                Add unit
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}

      {listQuery.data && items.length > 0 && (
        <>
          <ExplorerGrid view={view}>
            {items.map((unit) => {
              const title = unit.name
                ? `${unit.code} · ${unit.name}`
                : unit.code;
              const metaParts = [
                unit.floor ? `Floor ${unit.floor}` : null,
                formatUnitStatus(unit.status),
                !unit.isActive ? "Not bookable" : null,
              ].filter(Boolean);

              const tone =
                unit.status === "MAINTENANCE"
                  ? "warn"
                  : unit.status === "INACTIVE"
                    ? "muted"
                    : "default";

              return (
                <ExplorerItem
                  key={unit.id}
                  view={view}
                  title={title}
                  meta={metaParts.join(" · ") || "—"}
                  canManage={canManage}
                  badge={
                    unit.status !== "ACTIVE" && (
                      <StatusBadge
                        label={formatUnitStatus(unit.status)}
                        tone={tone}
                      />
                    )
                  }
                  onEdit={() => {
                    setEditTarget(unit);
                    setFormOpen(true);
                  }}
                  onDelete={
                    canManage
                      ? () => {
                          setDeleteTarget(unit);
                        }
                      : undefined
                  }
                />
              );
            })}
          </ExplorerGrid>
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

      <UnitFormDialog
        open={formOpen}
        readOnly={!canManage}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditTarget(null);
          }
        }}
        propertyId={propertyId}
        unitTypeId={unitTypeId}
        unit={editTarget}
      />

      {canManage && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          title="Delete unit?"
          description={
            <>
              This permanently removes <strong>{deleteTarget?.code}</strong>.
            </>
          }
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => {
            if (deleteTarget) {
              deleteMutation.mutate({
                id: deleteTarget.id,
                code: deleteTarget.code,
              });
            }
          }}
        />
      )}
    </>
  );
}
