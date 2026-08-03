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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["inventory", "common"]);
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
      (propertyId ? findStaffPropertyName(queryClient, propertyId) : undefined),
    [navState.propertyName, propertyId, queryClient],
  );

  const propertyQuery = useQuery({
    queryKey: staffPropertyQueryKey(propertyId),
    queryFn: () => getProperty(propertyId),
    enabled: Boolean(propertyId) && !propertyNameHint,
  });

  const propertyReady = Boolean(propertyNameHint) || propertyQuery.isSuccess;
  const propertyName = propertyQuery.data?.name ?? propertyNameHint ?? "…";

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
      handleSuccess(
        t("inventory:unitTypes.page.deletedToast", { name: variables.name }),
      );
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
          createLabel={t("inventory:unitTypes.page.addLabel")}
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
          createLabel={t("inventory:unitTypes.page.addLabel")}
          canManage={false}
          onCreate={() => undefined}
        />
        <QueryErrorPanel
          message={t("inventory:unitTypes.page.loadPropertyError")}
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
        createLabel={t("inventory:unitTypes.page.addLabel")}
        canManage={canManage}
        onCreate={openCreate}
      />

      {listQuery.isPending && <ExplorerGridSkeleton view={view} />}

      {listQuery.isError && !listQuery.data && (
        <QueryErrorPanel
          message={t("inventory:unitTypes.page.loadListError")}
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
              {q
                ? t("inventory:unitTypes.page.emptyTitleFiltered")
                : t("inventory:unitTypes.page.emptyTitle")}
            </EmptyTitle>
            <EmptyDescription>
              {q
                ? t("inventory:unitTypes.page.emptyDescriptionFiltered")
                : t("inventory:unitTypes.page.emptyDescription", {
                    propertyName,
                  })}
            </EmptyDescription>
          </EmptyHeader>
          {!q && canManage && (
            <EmptyContent>
              <Button type="button" size="sm" onClick={openCreate}>
                {t("inventory:unitTypes.page.addLabel")}
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
                t("inventory:unitTypes.page.metaMaxGuests", {
                  count: unitType.maxGuests,
                }),
                `${t("inventory:unitTypes.page.metaPricePerNight", { price: formatIdr(unitType.defaultPriceIdr) })} · ${t("inventory:unitTypes.page.metaPricePerMonth", { price: formatIdr(unitType.monthlyPriceIdr) })}`,
                beds,
                amenityCount > 0
                  ? t("inventory:unitTypes.page.metaAmenityCount", {
                      count: amenityCount,
                    })
                  : null,
                unitType.smokingAllowed
                  ? t("inventory:unitTypes.page.metaSmokingOk")
                  : null,
                t("inventory:unitTypes.page.metaUnitCount", {
                  count: unitType.unitCount,
                }),
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
                      <StatusBadge
                        label={t("inventory:unitTypes.page.inactiveBadge")}
                        tone="muted"
                      />
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

      {formOpen && (
        <UnitTypeFormDialog
          key={editTarget?.id ?? "create"}
          open
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
      )}

      {canManage && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          title={t("inventory:unitTypes.page.deleteTitle")}
          description={
            deleteBlocked
              ? t("inventory:unitTypes.page.deleteDescriptionBlocked", {
                  count: deleteUnitCount,
                  name: deleteTarget?.name ?? "",
                })
              : t("inventory:unitTypes.page.deleteDescription", {
                  name: deleteTarget?.name ?? "",
                })
          }
          confirmLabel={
            deleteBlocked
              ? t("inventory:unitTypes.page.confirmGotIt")
              : t("inventory:unitTypes.page.confirmDelete")
          }
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
