/* anchor: Linear-dense explorer, diverge: unit types under a property */
import { useMemo, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { StaffUnitType } from "@cabin/api-contract";
import { LayersIcon } from "lucide-react";
import { InfiniteListFooter } from "@/components/infinite-list-footer";
import { QueryErrorPanel } from "@/components/query-error-panel";
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
import {
  ApiError,
  deleteUnitType,
  getNextPageParamFromPageInfo,
  getProperty,
  handleError,
  handleSuccess,
  INFINITE_INITIAL_PAGE,
  invalidateInventoryCaches,
  listUnitTypes,
  staffPropertyQueryKey,
  staffUnitTypesQueryKey,
} from "@/lib/api";
import {
  ExplorerGrid,
  ExplorerGridSkeleton,
  ExplorerItem,
  StatusBadge,
} from "@/components/explorer/explorer-item";
import { useExplorerSearchParams } from "@/components/explorer/explorer-params";
import { ExplorerToolbar } from "./explorer-toolbar";
import {
  findStaffPropertyName,
  parseExplorerNavState,
} from "./explorer-nav-state";
import { useInventoryAccess } from "./inventory-access";
import { formatLayout, formatIdr, firstImageUrl } from "./inventory-types";
import { countAmenities, formatBedSummary } from "./amenity-catalog";
import { UnitTypeFormDialog } from "./unit-type-form-dialog";

export function UnitTypesPage() {
  const { propertyId = "" } = useParams();
  const location = useLocation();
  const { canManage } = useInventoryAccess();
  const { q, view } = useExplorerSearchParams();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffUnitType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffUnitType | null>(null);

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

  const propertyQuery = useQuery({
    queryKey: staffPropertyQueryKey(propertyId),
    queryFn: () => getProperty(propertyId),
    enabled: Boolean(propertyId) && !propertyNameHint,
  });

  const propertyReady =
    Boolean(propertyNameHint) || propertyQuery.isSuccess;
  const propertyName =
    propertyQuery.data?.name ?? propertyNameHint ?? "…";

  const listFilters = useMemo(() => ({ q: q.trim() || undefined }), [q]);

  const listQuery = useInfiniteQuery({
    queryKey: staffUnitTypesQueryKey(propertyId, listFilters),
    queryFn: ({ pageParam }) =>
      listUnitTypes(propertyId, { page: pageParam, q: listFilters.q }),
    initialPageParam: INFINITE_INITIAL_PAGE,
    getNextPageParam: getNextPageParamFromPageInfo,
    enabled: Boolean(propertyId) && propertyReady,
  });

  const deleteMutation = useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      deleteUnitType(input.id),
    onSuccess: (_data, variables) => {
      setDeleteTarget(null);
      invalidateInventoryCaches(queryClient);
      handleSuccess(`Deleted ${variables.name}`);
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data],
  );

  const propertyNotFound =
    !propertyNameHint &&
    propertyQuery.isError &&
    propertyQuery.error instanceof ApiError &&
    propertyQuery.error.status === 404;

  if (propertyNotFound) {
    return <Navigate to="/properties" replace />;
  }

  if (!propertyReady && propertyQuery.isPending) {
    return (
      <>
        <ExplorerToolbar
          layer="types"
          createLabel="Add type"
          canManage={false}
          onCreate={() => undefined}
        />
        <ExplorerGridSkeleton view={view} />
      </>
    );
  }

  if (!propertyNameHint && propertyQuery.isError) {
    return (
      <>
        <ExplorerToolbar
          layer="types"
          createLabel="Add type"
          canManage={false}
          onCreate={() => undefined}
        />
        <QueryErrorPanel
          message="Couldn’t load this property. Check your connection and try again."
          onRetry={() => {
            void propertyQuery.refetch();
          }}
          isRetrying={propertyQuery.isFetching}
        />
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

  const deleteUnitCount = deleteTarget?.unitCount ?? 0;
  const deleteBlocked = deleteUnitCount > 0;

  return (
    <>
      <ExplorerToolbar
        layer="types"
        createLabel="Add type"
        canManage={canManage}
        onCreate={openCreate}
      />

      {listQuery.isPending && <ExplorerGridSkeleton view={view} />}

      {listQuery.isError && !listQuery.data && (
        <QueryErrorPanel
          message="Couldn’t load unit types. Check your connection and try again."
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
              <LayersIcon />
            </EmptyMedia>
            <EmptyTitle>
              {q ? "No matching types" : "No unit types yet"}
            </EmptyTitle>
            <EmptyDescription>
              {q
                ? "Try a different search."
                : `Add types for ${propertyName} — shared beds, size, and guest limits.`}
            </EmptyDescription>
          </EmptyHeader>
          {!q && canManage && (
            <EmptyContent>
              <Button type="button" size="sm" onClick={openCreate}>
                Add type
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}

      {listQuery.data && items.length > 0 && (
        <>
          <ExplorerGrid view={view}>
            {items.map((unitType) => {
              const amenityCount = countAmenities(unitType.amenities);
              const beds = formatBedSummary(unitType.bedConfig);
              const metaParts = [
                formatLayout(unitType.layout),
                unitType.sizeSqm != null ? `${unitType.sizeSqm} m²` : null,
                `Max ${unitType.maxGuests}`,
                `${formatIdr(unitType.defaultPriceIdr)}/night`,
                beds,
                amenityCount > 0
                  ? `${amenityCount} amenit${amenityCount === 1 ? "y" : "ies"}`
                  : null,
                unitType.smokingAllowed ? "Smoking OK" : null,
                `${unitType.unitCount} unit${unitType.unitCount === 1 ? "" : "s"}`,
                unitType.code,
              ].filter(Boolean);

              return (
                <ExplorerItem
                  key={unitType.id}
                  view={view}
                  title={unitType.name}
                  meta={metaParts.join(" · ")}
                  href={`/properties/${propertyId}/types/${unitType.id}`}
                  linkState={{
                    propertyName,
                    unitTypeName: unitType.name,
                  }}
                  imageUrl={firstImageUrl(unitType.media)}
                  canManage={canManage}
                  badge={
                    !unitType.isActive && (
                      <StatusBadge label="Inactive" tone="muted" />
                    )
                  }
                  onEdit={() => {
                    setEditTarget(unitType);
                    setFormOpen(true);
                  }}
                  onDelete={
                    canManage
                      ? () => {
                          setDeleteTarget(unitType);
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

      <UnitTypeFormDialog
        open={formOpen}
        readOnly={!canManage}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditTarget(null);
          }
        }}
        propertyId={propertyId}
        unitType={editTarget}
      />

      {canManage && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          title="Delete unit type?"
          description={
            deleteBlocked ? (
              <>
                Cannot delete <strong>{deleteTarget?.name}</strong> while{" "}
                {deleteUnitCount} unit{deleteUnitCount === 1 ? "" : "s"} still
                use it. Remove or reassign those units first.
              </>
            ) : (
              <>
                This permanently removes <strong>{deleteTarget?.name}</strong>.
              </>
            )
          }
          confirmLabel={deleteBlocked ? "Got it" : "Delete"}
          variant={deleteBlocked ? "default" : "destructive"}
          confirmDisabled={deleteMutation.isPending}
          onConfirm={() => {
            if (deleteBlocked) {
              setDeleteTarget(null);
              return;
            }
            if (deleteTarget) {
              deleteMutation.mutate({
                id: deleteTarget.id,
                name: deleteTarget.name,
              });
            }
          }}
        />
      )}
    </>
  );
}
