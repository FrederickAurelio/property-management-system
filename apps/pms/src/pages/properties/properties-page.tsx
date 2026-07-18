/* anchor: Linear-dense explorer, diverge: properties root list */
import { useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { StaffProperty } from "@cabin/api-contract";
import { Building2Icon } from "lucide-react";
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
import {
  deleteProperty,
  getNextPageParamFromPageInfo,
  handleError,
  handleSuccess,
  INFINITE_INITIAL_PAGE,
  listProperties,
  staffPropertiesQueryKey,
  staffPropertiesQueryKeyPrefix,
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
      void queryClient.invalidateQueries({
        queryKey: staffPropertiesQueryKeyPrefix,
      });
      handleSuccess(`Deleted ${variables.name}`);
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
        createLabel="Add property"
        canManage={canManage}
        onCreate={openCreate}
      />

      {listQuery.isPending && <ExplorerGridSkeleton view={view} />}

      {listQuery.isError && !listQuery.data && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border px-4 py-6">
          <p className="text-sm text-muted-foreground">
            Couldn’t load properties. Check your connection and try again.
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
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>
              {q ? "No matching properties" : "No properties yet"}
            </EmptyTitle>
            <EmptyDescription>
              {q
                ? "Try a different search."
                : "Add a property to start organizing unit types and units."}
            </EmptyDescription>
          </EmptyHeader>
          {!q && canManage && (
            <EmptyContent>
              <Button type="button" size="sm" onClick={openCreate}>
                Add property
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
                `${property.typeCount} type${property.typeCount === 1 ? "" : "s"}`,
                `${property.unitCount} unit${property.unitCount === 1 ? "" : "s"}`,
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
                      <StatusBadge label="Inactive" tone="muted" />
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
          title="Delete property?"
          description={
            deleteBlocked ? (
              <>
                Cannot delete <strong>{deleteTarget?.name}</strong> while it
                still has {deleteTypeCount} type
                {deleteTypeCount === 1 ? "" : "s"} and {deleteUnitCount} unit
                {deleteUnitCount === 1 ? "" : "s"}. Remove those first.
              </>
            ) : (
              <>
                This permanently removes <strong>{deleteTarget?.name}</strong>.
              </>
            )
          }
          confirmLabel={deleteBlocked ? "Got it" : "Delete"}
          variant={deleteBlocked ? "default" : "destructive"}
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
