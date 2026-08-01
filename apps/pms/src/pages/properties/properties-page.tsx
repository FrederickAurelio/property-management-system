/* anchor: Linear-dense explorer, diverge: properties root list */
import { useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { StaffProperty } from "@cabin/api-contract";
import { Building2Icon } from "lucide-react";
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
  deleteProperty,
  getNextPageParamFromPageInfo,
  handleError,
  handleSuccess,
  INFINITE_INITIAL_PAGE,
  invalidateInventoryCaches,
  listProperties,
  staffPropertiesQueryKey,
} from "@/lib/api";
import {
  ExplorerGrid,
  ExplorerGridSkeleton,
  ExplorerItem,
  StatusBadge,
} from "@/components/explorer/explorer-item";
import { useExplorerSearchParams } from "@/components/explorer/explorer-params";
import { ExplorerToolbar } from "./explorer-toolbar";
import { useInventoryAccess } from "./inventory-access";
import { PropertyFormDialog } from "./property-form-dialog";

export function PropertiesPage() {
  const { t } = useTranslation(["inventory", "common"]);
  const { canManage } = useInventoryAccess();
  const { q, view } = useExplorerSearchParams();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffProperty | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffProperty | null>(null);

  const listFilters = useMemo(() => ({ q: q.trim() || undefined }), [q]);

  const listQuery = useInfiniteQuery({
    queryKey: staffPropertiesQueryKey(listFilters),
    queryFn: ({ pageParam }) =>
      listProperties({ page: pageParam, q: listFilters.q }),
    initialPageParam: INFINITE_INITIAL_PAGE,
    getNextPageParam: getNextPageParamFromPageInfo,
  });

  const deleteMutation = useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      deleteProperty(input.id),
    onSuccess: (_data, variables) => {
      setDeleteTarget(null);
      invalidateInventoryCaches(queryClient);
      handleSuccess(
        t("inventory:properties.page.deletedToast", { name: variables.name }),
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

  function openCreate() {
    if (!canManage) {
      return;
    }
    setEditTarget(null);
    setFormOpen(true);
  }

  const deleteTypeCount = deleteTarget?.typeCount ?? 0;
  const deleteUnitCount = deleteTarget?.unitCount ?? 0;
  const deleteBlocked = deleteTypeCount > 0 || deleteUnitCount > 0;

  return (
    <>
      <ExplorerToolbar
        layer="properties"
        createLabel={t("inventory:properties.page.addLabel")}
        canManage={canManage}
        onCreate={openCreate}
      />

      {listQuery.isPending && <ExplorerGridSkeleton view={view} />}

      {listQuery.isError && !listQuery.data && (
        <QueryErrorPanel
          message={t("inventory:properties.page.loadError")}
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
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>
              {q
                ? t("inventory:properties.page.emptyTitleFiltered")
                : t("inventory:properties.page.emptyTitle")}
            </EmptyTitle>
            <EmptyDescription>
              {q
                ? t("inventory:properties.page.emptyDescriptionFiltered")
                : t("inventory:properties.page.emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
          {!q && canManage && (
            <EmptyContent>
              <Button type="button" size="sm" onClick={openCreate}>
                {t("inventory:properties.page.addLabel")}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}

      {listQuery.data && items.length > 0 && (
        <>
          <ExplorerGrid view={view}>
            {items.map((property) => {
              const metaParts = [
                property.city,
                property.code,
                t("inventory:properties.page.typeCount", {
                  count: property.typeCount,
                }),
                t("inventory:properties.page.unitCount", {
                  count: property.unitCount,
                }),
              ].filter(Boolean);

              return (
                <ExplorerItem
                  key={property.id}
                  view={view}
                  title={property.name}
                  meta={metaParts.join(" · ")}
                  href={`/properties/${property.id}`}
                  linkState={{ propertyName: property.name }}
                  imageUrl={property.coverImage?.url}
                  canManage={canManage}
                  badge={
                    !property.isActive && (
                      <StatusBadge
                        label={t("inventory:properties.page.inactiveBadge")}
                        tone="muted"
                      />
                    )
                  }
                  onEdit={() => {
                    setEditTarget(property);
                    setFormOpen(true);
                  }}
                  onDelete={
                    canManage
                      ? () => {
                          setDeleteTarget(property);
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

      <PropertyFormDialog
        open={formOpen}
        readOnly={!canManage}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditTarget(null);
          }
        }}
        property={editTarget}
      />

      {canManage && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          title={t("inventory:properties.page.deleteTitle")}
          description={
            deleteBlocked
              ? t("inventory:properties.page.deleteDescriptionBlocked", {
                  name: deleteTarget?.name ?? "",
                  typeCount: t("inventory:properties.page.typeCount", {
                    count: deleteTypeCount,
                  }),
                  unitCount: t("inventory:properties.page.unitCount", {
                    count: deleteUnitCount,
                  }),
                })
              : t("inventory:properties.page.deleteDescription", {
                  name: deleteTarget?.name ?? "",
                })
          }
          confirmLabel={
            deleteBlocked
              ? t("inventory:properties.page.confirmGotIt")
              : t("inventory:properties.page.confirmDelete")
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
