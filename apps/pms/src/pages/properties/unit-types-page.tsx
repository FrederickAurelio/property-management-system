/* anchor: Linear-dense explorer, diverge: unit types under a property */
import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router";
import { LayersIcon } from "lucide-react";
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
import { useInventoryAccess } from "./inventory-access";
import { formatLayout, formatIdr, firstImageUrl, type UnitType } from "./inventory-types";
import { countAmenities, formatBedSummary } from "./amenity-catalog";
// MOCK — replace imports with API client + useMutation when backend is wired.
import {
  InventoryConflictError,
  deleteUnitType,
  useInventory,
} from "./mock-inventory";
import { UnitTypeFormDialog } from "./unit-type-form-dialog";

export function UnitTypesPage() {
  const { propertyId = "" } = useParams();
  const { canManage } = useInventoryAccess();
  // MOCK — read full inventory snapshot; replace with useQuery per propertyId.
  const inventory = useInventory();
  const { q, view } = useExplorerSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UnitType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnitType | null>(null);

  // MOCK — resolve property from local store; replace with useQuery property detail.
  const property = inventory.properties.find((p) => p.id === propertyId);

  // MOCK — aggregate unit counts client-side; API list should return unitCount per type.
  const unitCountByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of inventory.units) {
      counts.set(u.unitTypeId, (counts.get(u.unitTypeId) ?? 0) + 1);
    }
    return counts;
  }, [inventory.units]);

  // MOCK — client-side filter/sort; move to GET /properties/:id/unit-types?q=.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = inventory.unitTypes
      .filter((t) => t.propertyId === propertyId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    if (!needle) {
      return list;
    }
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        t.code.toLowerCase().includes(needle),
    );
  }, [inventory.unitTypes, propertyId, q]);

  if (!property) {
    return <Navigate to="/properties" replace />;
  }

  function openCreate() {
    if (!canManage) {
      return;
    }
    setEditTarget(null);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    try {
      // MOCK — local delete; replace with DELETE /unit-types/:id mutation.
      deleteUnitType(deleteTarget.id);
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

  // MOCK — delete guard count; API should return unitCount on unit-type detail.
  const deleteUnitCount = deleteTarget
    ? (unitCountByType.get(deleteTarget.id) ?? 0)
    : 0;
  const deleteBlocked = deleteUnitCount > 0;

  return (
    <>
      <ExplorerToolbar
        layer="types"
        createLabel="Add type"
        canManage={canManage}
        onCreate={openCreate}
      />

      {filtered.length === 0 ? (
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
                : `Add types for ${property.name} — shared beds, size, and guest limits.`}
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
      ) : (
        <ExplorerGrid view={view}>
          {filtered.map((unitType) => {
            const unitCount = unitCountByType.get(unitType.id) ?? 0;
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
              `${unitCount} unit${unitCount === 1 ? "" : "s"}`,
              unitType.code,
            ].filter(Boolean);

            return (
              <ExplorerItem
                key={unitType.id}
                view={view}
                title={unitType.name}
                meta={metaParts.join(" · ")}
                href={`/properties/${propertyId}/types/${unitType.id}`}
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
              {deleteUnitCount} unit{deleteUnitCount === 1 ? "" : "s"} still use
              it. Remove or reassign those units first.
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
      )}
    </>
  );
}
