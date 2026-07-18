/* anchor: Linear-dense explorer, diverge: units under a type */
import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router";
import { DoorOpenIcon } from "lucide-react";
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
import { handleSuccess } from "@/lib/api";
import {
  ExplorerGrid,
  ExplorerItem,
  StatusBadge,
} from "@/components/explorer/explorer-item";
import { useExplorerSearchParams } from "@/components/explorer/explorer-params";
import { ExplorerToolbar } from "./explorer-toolbar";
import { useInventoryAccess } from "./inventory-access";
import {
  formatUnitStatus,
  type Unit,
  type UnitStatus,
} from "./inventory-types";
// MOCK — replace imports with API client + useMutation when backend is wired.
import { deleteUnit, useInventory } from "./mock-inventory";
import { UnitFormDialog } from "./unit-form-dialog";

export function UnitsPage() {
  const { propertyId = "", unitTypeId = "" } = useParams();
  const { canManage } = useInventoryAccess();
  // MOCK — read full inventory snapshot; replace with useQuery per unitTypeId.
  const inventory = useInventory();
  const { q, view, status } = useExplorerSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Unit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);

  // MOCK — resolve parent entities from local store; replace with useQuery detail.
  const property = inventory.properties.find((p) => p.id === propertyId);
  const unitType = inventory.unitTypes.find(
    (t) => t.id === unitTypeId && t.propertyId === propertyId,
  );

  // MOCK — client-side filter/sort; move to GET /staff/unit-types/:id/units?q=&status=.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = inventory.units
      .filter((u) => u.unitTypeId === unitTypeId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

    if (status !== "all") {
      list = list.filter((u) => u.status === (status as UnitStatus));
    }
    if (needle) {
      list = list.filter(
        (u) =>
          u.code.toLowerCase().includes(needle) ||
          (u.name?.toLowerCase().includes(needle) ?? false) ||
          (u.floor?.toLowerCase().includes(needle) ?? false),
      );
    }
    return list;
  }, [inventory.units, unitTypeId, q, status]);

  if (!property || !unitType) {
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
    // MOCK — local delete; replace with DELETE /staff/units/:id mutation.
    deleteUnit(deleteTarget.id);
    handleSuccess(`Deleted ${deleteTarget.code}`);
    setDeleteTarget(null);
  }

  return (
    <>
      <ExplorerToolbar
        layer="units"
        createLabel="Add unit"
        canManage={canManage}
        onCreate={openCreate}
      />

      {filtered.length === 0 ? (
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
                : `Add physical units for ${unitType.name}. Each gets its own calendar.`}
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
      ) : (
        <ExplorerGrid view={view}>
          {filtered.map((unit) => {
            const title = unit.name ? `${unit.code} · ${unit.name}` : unit.code;
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
            This permanently removes <strong>{deleteTarget?.code}</strong> from
            the mock inventory.
          </>
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />
      )}
    </>
  );
}
