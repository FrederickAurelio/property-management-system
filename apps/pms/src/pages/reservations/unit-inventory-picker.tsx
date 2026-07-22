/* anchor: Inventory explorer pick, diverge: local layers + Confirm unit (no CRUD/routes) */
import { useMemo, useState } from "react";
import {
  UnitAvailabilityBlockReason,
  type StaffUnit,
  type StaffUnitAvailability,
  type UnitAvailabilityBlockReason as BlockReason,
} from "@cabin/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import {
  ExplorerGrid,
  ExplorerGridSkeleton,
  ExplorerItem,
  StatusBadge,
} from "@/components/explorer/explorer-item";
import type { ExplorerView } from "@/components/explorer/types";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";
import { InfiniteListFooter } from "@/components/infinite-list-footer";
import { QueryErrorPanel } from "@/components/query-error-panel";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  getNextPageParamFromPageInfo,
  INFINITE_INITIAL_PAGE,
  listAvailableUnits,
  listProperties,
  listUnitTypes,
  staffPropertiesQueryKey,
  staffUnitsAvailabilityQueryKey,
  staffUnitTypesQueryKey,
} from "@/lib/api";
import {
  firstImageUrl,
  formatUnitStatus,
} from "@/pages/properties/inventory-types";
import type { ChosenUnit } from "./chosen-unit";

const SEARCH_DEBOUNCE_MS = 300;

type Layer = "properties" | "types" | "units";

type UnitInventoryPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (chosen: ChosenUnit) => void;
  /** Stay range required for free-unit filtering. */
  checkInDate: string;
  checkOutDate: string;
  /** Prefill when editing an existing stay (jump to unit layer). */
  initialPropertyId?: string;
  initialPropertyName?: string;
  initialUnitTypeId?: string;
  initialUnitTypeName?: string;
  initialUnitId?: string;
  /** Editing: ignore this reservation for DATE_OVERLAP. */
  excludeReservationId?: string;
};

function unitLabel(unit: Pick<StaffUnit, "code" | "name">): string {
  return unit.name ? `${unit.code} · ${unit.name}` : unit.code;
}

function blockReasonBadge(
  unit: StaffUnitAvailability,
): { label: string; tone: "muted" | "warn" } | null {
  if (unit.available || !unit.blockReason) {
    return null;
  }
  return {
    label: blockReasonLabel(unit.blockReason, unit.status),
    tone:
      unit.blockReason === UnitAvailabilityBlockReason.DATE_OVERLAP
        ? "warn"
        : "muted",
  };
}

function blockReasonLabel(
  reason: BlockReason,
  status: StaffUnit["status"],
): string {
  switch (reason) {
    case UnitAvailabilityBlockReason.PROPERTY_INACTIVE:
      return "Property closed";
    case UnitAvailabilityBlockReason.UNIT_TYPE_INACTIVE:
      return "Type not offered";
    case UnitAvailabilityBlockReason.UNIT_NOT_BOOKABLE:
      return formatUnitStatus(status);
    case UnitAvailabilityBlockReason.DATE_OVERLAP:
      return "Booked";
  }
}

/** Edit with a known unit → units layer. Create / fresh pick → properties. */
function initialLayer(args: {
  propertyId: string;
  unitTypeId: string;
  unitId: string;
}): Layer {
  if (args.propertyId && args.unitTypeId && args.unitId) {
    return "units";
  }
  return "properties";
}

export function UnitInventoryPicker({
  open,
  onOpenChange,
  onConfirm,
  checkInDate,
  checkOutDate,
  initialPropertyId = "",
  initialPropertyName = "",
  initialUnitTypeId = "",
  initialUnitTypeName = "",
  initialUnitId = "",
  excludeReservationId,
}: UnitInventoryPickerProps) {
  const view: ExplorerView = "list";
  const jumpToUnits = Boolean(
    initialPropertyId && initialUnitTypeId && initialUnitId,
  );
  const [layer, setLayer] = useState<Layer>(() =>
    initialLayer({
      propertyId: initialPropertyId,
      unitTypeId: initialUnitTypeId,
      unitId: initialUnitId,
    }),
  );
  const [q, setQ] = useState("");
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [propertyName, setPropertyName] = useState(initialPropertyName);
  const [unitTypeId, setUnitTypeId] = useState(
    jumpToUnits ? initialUnitTypeId : "",
  );
  const [unitTypeName, setUnitTypeName] = useState(
    jumpToUnits ? initialUnitTypeName : "",
  );
  const [unitTypeDefaultPriceIdr, setUnitTypeDefaultPriceIdr] = useState<
    number | undefined
  >(undefined);
  const [userSelected, setUserSelected] = useState<ChosenUnit | null>(null);

  const debouncedQ = useDebouncedValue(q, SEARCH_DEBOUNCE_MS);

  const propertiesQuery = useInfiniteQuery({
    queryKey: staffPropertiesQueryKey({
      ...(debouncedQ ? { q: debouncedQ } : {}),
    }),
    queryFn: ({ pageParam }) =>
      listProperties({
        page: pageParam,
        pageSize: 20,
        ...(debouncedQ ? { q: debouncedQ } : {}),
      }),
    initialPageParam: INFINITE_INITIAL_PAGE,
    getNextPageParam: getNextPageParamFromPageInfo,
    enabled: open && layer === "properties",
  });

  const typesQuery = useInfiniteQuery({
    queryKey: staffUnitTypesQueryKey(propertyId, {
      ...(debouncedQ ? { q: debouncedQ } : {}),
    }),
    queryFn: ({ pageParam }) =>
      listUnitTypes(propertyId, {
        page: pageParam,
        pageSize: 20,
        ...(debouncedQ ? { q: debouncedQ } : {}),
      }),
    initialPageParam: INFINITE_INITIAL_PAGE,
    getNextPageParam: getNextPageParamFromPageInfo,
    enabled: open && layer === "types" && Boolean(propertyId),
  });

  const datesReady =
    Boolean(checkInDate) && Boolean(checkOutDate) && checkOutDate > checkInDate;

  const unitsQuery = useQuery({
    queryKey: staffUnitsAvailabilityQueryKey(propertyId, {
      ...(datesReady ? { checkInDate, checkOutDate } : {}),
      unitTypeId,
      ...(excludeReservationId ? { excludeReservationId } : {}),
    }),
    queryFn: () =>
      listAvailableUnits(propertyId, {
        ...(datesReady ? { checkInDate, checkOutDate } : {}),
        unitTypeId,
        ...(excludeReservationId ? { excludeReservationId } : {}),
      }),
    enabled:
      open && layer === "units" && Boolean(propertyId) && Boolean(unitTypeId),
    staleTime: 0,
  });

  const properties = useMemo(
    () => propertiesQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [propertiesQuery.data],
  );
  const types = useMemo(
    () => typesQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [typesQuery.data],
  );
  const units = useMemo(() => {
    const items = unitsQuery.data ?? [];
    if (!debouncedQ.trim()) {
      return items;
    }
    const needle = debouncedQ.trim().toLowerCase();
    return items.filter(
      (u) =>
        u.code.toLowerCase().includes(needle) ||
        (u.name?.toLowerCase().includes(needle) ?? false),
    );
  }, [unitsQuery.data, debouncedQ]);

  const selectedUnit = useMemo((): ChosenUnit | null => {
    if (userSelected) {
      const stillAvailable = units.find(
        (u) => u.id === userSelected.unitId && u.available,
      );
      return stillAvailable ? userSelected : null;
    }
    if (layer !== "units" || !initialUnitId) {
      return null;
    }
    const match = units.find((u) => u.id === initialUnitId && u.available);
    if (!match) {
      return null;
    }
    return {
      propertyId,
      propertyName,
      unitTypeId,
      unitTypeName,
      defaultPriceIdr: unitTypeDefaultPriceIdr,
      unitId: match.id,
      unitCode: match.code,
      unitName: match.name,
    };
  }, [
    userSelected,
    layer,
    initialUnitId,
    units,
    propertyId,
    propertyName,
    unitTypeId,
    unitTypeName,
    unitTypeDefaultPriceIdr,
  ]);

  const title =
    layer === "properties"
      ? "Choose property"
      : layer === "types"
        ? "Choose unit type"
        : "Choose unit";

  const activeQuery =
    layer === "properties"
      ? propertiesQuery
      : layer === "types"
        ? typesQuery
        : unitsQuery;

  return (
    <ResponsiveFormShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        datesReady
          ? "Open properties · offered types · all units for these dates (blocked rows stay visible)."
          : "Open properties · offered types · all units. Set stay dates later to see date conflicts."
      }
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          {layer === "units" && (
            <Button
              type="button"
              disabled={!selectedUnit}
              onClick={() => {
                if (!selectedUnit) {
                  return;
                }
                onConfirm(selectedUnit);
                onOpenChange(false);
              }}
            >
              Confirm
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 p-1">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {layer === "properties" ? (
                <BreadcrumbPage>Properties</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setLayer("properties");
                      setQ("");
                      setPropertyId("");
                      setPropertyName("");
                      setUnitTypeId("");
                      setUnitTypeName("");
                      setUnitTypeDefaultPriceIdr(undefined);
                      setUserSelected(null);
                    }}
                  >
                    Properties
                  </button>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {propertyId ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {layer === "types" ? (
                    <BreadcrumbPage className="max-w-[10rem] truncate">
                      {propertyName || "Property"}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button
                        type="button"
                        className="max-w-[10rem] truncate"
                        onClick={() => {
                          setLayer("types");
                          setQ("");
                          setUnitTypeId("");
                          setUnitTypeName("");
                          setUnitTypeDefaultPriceIdr(undefined);
                          setUserSelected(null);
                        }}
                      >
                        {propertyName || "Property"}
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </>
            ) : null}
            {unitTypeId ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="max-w-[10rem] truncate">
                    {unitTypeName || "Type"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>

        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
            placeholder={
              layer === "properties"
                ? "Search properties…"
                : layer === "types"
                  ? "Search unit types…"
                  : "Search units…"
            }
            aria-label="Search"
          />
        </InputGroup>

        {activeQuery.isLoading && (
          <ExplorerGridSkeleton view={view} count={5} />
        )}

        {activeQuery.isError && !activeQuery.data && (
          <QueryErrorPanel
            message="Couldn’t load inventory. Try again."
            onRetry={() => {
              void activeQuery.refetch();
            }}
            isRetrying={activeQuery.isFetching}
          />
        )}

        {activeQuery.data &&
          (layer === "properties"
            ? properties.length === 0
            : layer === "types"
              ? types.length === 0
              : units.length === 0) && (
            <Empty className="border border-dashed py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon" />
                <EmptyTitle>Nothing here</EmptyTitle>
                <EmptyDescription>
                  {layer === "units"
                    ? "No units in this type."
                    : "Try another search."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

        {layer === "properties" && properties.length > 0 && (
          <>
            <ExplorerGrid view={view}>
              {properties.map((property) => (
                <ExplorerItem
                  key={property.id}
                  view={view}
                  title={property.name}
                  meta={`${property.unitCount} unit${property.unitCount === 1 ? "" : "s"}`}
                  imageUrl={property.coverImage?.url}
                  canManage={false}
                  badge={
                    !property.isActive ? (
                      <StatusBadge label="Inactive" tone="muted" />
                    ) : undefined
                  }
                  onSelect={() => {
                    setPropertyId(property.id);
                    setPropertyName(property.name);
                    setUnitTypeId("");
                    setUnitTypeName("");
                    setUnitTypeDefaultPriceIdr(undefined);
                    setUserSelected(null);
                    setQ("");
                    setLayer("types");
                  }}
                />
              ))}
            </ExplorerGrid>
            <InfiniteListFooter
              hasNextPage={Boolean(propertiesQuery.hasNextPage)}
              isFetchingNextPage={propertiesQuery.isFetchingNextPage}
              isFetchNextPageError={propertiesQuery.isFetchNextPageError}
              fetchNextPage={() => {
                void propertiesQuery.fetchNextPage();
              }}
            />
          </>
        )}

        {layer === "types" && types.length > 0 && (
          <>
            <ExplorerGrid view={view}>
              {types.map((unitType) => (
                <ExplorerItem
                  key={unitType.id}
                  view={view}
                  title={unitType.name}
                  meta={`${unitType.unitCount} unit${unitType.unitCount === 1 ? "" : "s"} · ${unitType.code}`}
                  imageUrl={firstImageUrl(unitType.media)}
                  canManage={false}
                  badge={
                    !unitType.isActive ? (
                      <StatusBadge label="Inactive" tone="muted" />
                    ) : undefined
                  }
                  onSelect={() => {
                    setUnitTypeId(unitType.id);
                    setUnitTypeName(unitType.name);
                    setUnitTypeDefaultPriceIdr(unitType.defaultPriceIdr);
                    setUserSelected(null);
                    setQ("");
                    setLayer("units");
                  }}
                />
              ))}
            </ExplorerGrid>
            <InfiniteListFooter
              hasNextPage={Boolean(typesQuery.hasNextPage)}
              isFetchingNextPage={typesQuery.isFetchingNextPage}
              isFetchNextPageError={typesQuery.isFetchNextPageError}
              fetchNextPage={() => {
                void typesQuery.fetchNextPage();
              }}
            />
          </>
        )}

        {layer === "units" && units.length > 0 && (
          <ExplorerGrid view={view}>
            {units.map((unit) => {
              const chosen: ChosenUnit = {
                propertyId,
                propertyName,
                unitTypeId,
                unitTypeName,
                defaultPriceIdr: unitTypeDefaultPriceIdr,
                unitId: unit.id,
                unitCode: unit.code,
                unitName: unit.name,
              };
              const blocked = blockReasonBadge(unit);
              return (
                <ExplorerItem
                  key={unit.id}
                  view={view}
                  title={unitLabel(unit)}
                  meta={unit.floor ? `Floor ${unit.floor}` : "—"}
                  canManage={false}
                  disabled={!unit.available}
                  selected={selectedUnit?.unitId === unit.id}
                  badge={
                    blocked ? (
                      <StatusBadge label={blocked.label} tone={blocked.tone} />
                    ) : undefined
                  }
                  onSelect={
                    unit.available
                      ? () => {
                          setUserSelected(chosen);
                        }
                      : undefined
                  }
                />
              );
            })}
          </ExplorerGrid>
        )}
      </div>
    </ResponsiveFormShell>
  );
}
