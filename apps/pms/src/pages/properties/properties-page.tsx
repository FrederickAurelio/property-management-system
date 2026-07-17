/* anchor: Linear-dense explorer, diverge: properties root list */
import { useMemo, useState } from "react";
import { Building2Icon } from "lucide-react";
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
import { handleError, handleSuccess } from "@/lib/api";
import {
  ExplorerGrid,
  ExplorerItem,
  StatusBadge,
} from "@/components/explorer/explorer-item";
import { useExplorerSearchParams } from "@/components/explorer/explorer-params";
import { ExplorerToolbar } from "./explorer-toolbar";
import type { Property } from "./inventory-types";
// MOCK — replace imports with API client + useMutation when backend is wired.
import {
  InventoryConflictError,
  deleteProperty,
  useInventory,
} from "./mock-inventory";
import { PropertyFormDialog } from "./property-form-dialog";

export function PropertiesPage() {
  // MOCK — read full inventory snapshot; replace with useQuery("properties").
  const inventory = useInventory();
  const { q, view } = useExplorerSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);

  // MOCK — aggregate child counts client-side; API list should return typeCount/unitCount.
  const countsByProperty = useMemo(() => {
    const types = new Map<string, number>();
    const units = new Map<string, number>();
    for (const t of inventory.unitTypes) {
      types.set(t.propertyId, (types.get(t.propertyId) ?? 0) + 1);
    }
    for (const u of inventory.units) {
      units.set(u.propertyId, (units.get(u.propertyId) ?? 0) + 1);
    }
    return { types, units };
  }, [inventory.unitTypes, inventory.units]);

  // MOCK — client-side search/sort; move to API query params when wired.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = [...inventory.properties].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    if (!needle) {
      return list;
    }
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.code.toLowerCase().includes(needle) ||
        (p.city?.toLowerCase().includes(needle) ?? false),
    );
  }, [inventory.properties, q]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    try {
      // MOCK — local delete; replace with DELETE /properties/:id mutation.
      deleteProperty(deleteTarget.id);
      handleSuccess(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
    } catch (error) {
      if (error instanceof InventoryConflictError) {
        // MOCK — map to ApiError from envelope when API is wired.
        handleError(error);
        return;
      }
      throw error;
    }
  }

  // MOCK — delete guard counts; API should return these on property detail/list.
  const deleteTypeCount = deleteTarget
    ? (countsByProperty.types.get(deleteTarget.id) ?? 0)
    : 0;
  const deleteUnitCount = deleteTarget
    ? (countsByProperty.units.get(deleteTarget.id) ?? 0)
    : 0;
  const deleteBlocked = deleteTypeCount > 0 || deleteUnitCount > 0;

  return (
    <>
      <ExplorerToolbar
        layer="properties"
        createLabel="Add property"
        onCreate={openCreate}
      />

      {filtered.length === 0 ? (
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
          {!q && (
            <EmptyContent>
              <Button type="button" size="sm" onClick={openCreate}>
                Add property
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ExplorerGrid view={view}>
          {filtered.map((property) => {
            const typeCount = countsByProperty.types.get(property.id) ?? 0;
            const unitCount = countsByProperty.units.get(property.id) ?? 0;
            const metaParts = [
              property.city,
              property.code,
              `${typeCount} type${typeCount === 1 ? "" : "s"}`,
              `${unitCount} unit${unitCount === 1 ? "" : "s"}`,
            ].filter(Boolean);

            return (
              <ExplorerItem
                key={property.id}
                view={view}
                title={property.name}
                meta={metaParts.join(" · ")}
                href={`/properties/${property.id}`}
                imageUrl={property.coverImage?.url}
                badge={
                  !property.isActive && (
                    <StatusBadge label="Inactive" tone="muted" />
                  )
                }
                onEdit={() => {
                  setEditTarget(property);
                  setFormOpen(true);
                }}
                onDelete={() => {
                  setDeleteTarget(property);
                }}
              />
            );
          })}
        </ExplorerGrid>
      )}

      <PropertyFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditTarget(null);
          }
        }}
        property={editTarget}
      />

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
              Cannot delete <strong>{deleteTarget?.name}</strong> while it still
              has {deleteTypeCount} type
              {deleteTypeCount === 1 ? "" : "s"} and {deleteUnitCount} unit
              {deleteUnitCount === 1 ? "" : "s"}. Remove those first.
            </>
          ) : (
            <>
              This permanently removes <strong>{deleteTarget?.name}</strong> from
              the mock inventory.
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
          confirmDelete();
        }}
      />
    </>
  );
}
