/* anchor: Inventory explorer pick, diverge: local layers + Confirm unit (no CRUD/routes) */
import { useMemo, useState } from "react";
import {
  StayBillingPeriod,
  UnitAvailabilityBlockReason,
  type StaffUnit,
  type StaffUnitAvailability,
  type StayBillingPeriod as StayBillingPeriodType,
  type UnitAvailabilityBlockReason as BlockReason,
} from "@cabin/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import i18n from "@/i18n";
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
  /** Candidate period — MONTHLY/YEARLY widen DATE_OVERLAP to open inventory hold. */
  billingPeriod?: StayBillingPeriodType;
  /** Prefill when editing an existing stay (jump to unit layer). */
  initialPropertyId?: string;
  initialPropertyName?: string;
  initialUnitTypeId?: string;
  initialUnitTypeName?: string;
  initialUnitId?: string;
  /** Editing: ignore this reservation for DATE_OVERLAP. */
  excludeReservationId?: string;
  /** Editing a calendar block: ignore that block for DATE_OVERLAP. */
  excludeBlockId?: string;
};

function unitLabel(unit: Pick<StaffUnit, "code" | "name">): string {
  return unit.name ? `${unit.code} · ${unit.name}` : unit.code;
}

function unitCountLabel(count: number): string {
  return i18n.t("reservations:unitPicker.unitCount", { count });
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

/**
 * Staff may pick a DATE_OVERLAP (“Booked”) unit — stay/block dates can still
 * be adjusted, and Nest rejects true conflicts on save. Inactive / not-bookable
 * rows stay visible but not selectable.
 */
function canSelectUnit(unit: StaffUnitAvailability): boolean {
  return (
    unit.available ||
    unit.blockReason === UnitAvailabilityBlockReason.DATE_OVERLAP
  );
}

function blockReasonLabel(
  reason: BlockReason,
  status: StaffUnit["status"],
): string {
  switch (reason) {
    case UnitAvailabilityBlockReason.PROPERTY_INACTIVE:
      return i18n.t("reservations:unitPicker.blockReason.propertyClosed");
    case UnitAvailabilityBlockReason.UNIT_TYPE_INACTIVE:
      return i18n.t("reservations:unitPicker.blockReason.typeNotOffered");
    case UnitAvailabilityBlockReason.UNIT_NOT_BOOKABLE:
      return formatUnitStatus(status);
    case UnitAvailabilityBlockReason.DATE_OVERLAP:
      return i18n.t("reservations:unitPicker.blockReason.booked");
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
  billingPeriod = StayBillingPeriod.DAILY,
  initialPropertyId = "",
  initialPropertyName = "",
  initialUnitTypeId = "",
  initialUnitTypeName = "",
  initialUnitId = "",
  excludeReservationId,
  excludeBlockId,
}: UnitInventoryPickerProps) {
  const { t } = useTranslation(["reservations", "common"]);
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
  const [unitTypeRack, setUnitTypeRack] = useState<{
    defaultPriceIdr: number;
    monthlyPriceIdr: number;
    yearlyPriceIdr: number;
  } | null>(null);
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
      ...(datesReady ? { checkInDate, checkOutDate, billingPeriod } : {}),
      unitTypeId,
      ...(excludeReservationId ? { excludeReservationId } : {}),
      ...(excludeBlockId ? { excludeBlockId } : {}),
    }),
    queryFn: () =>
      listAvailableUnits(propertyId, {
        ...(datesReady ? { checkInDate, checkOutDate, billingPeriod } : {}),
        unitTypeId,
        ...(excludeReservationId ? { excludeReservationId } : {}),
        ...(excludeBlockId ? { excludeBlockId } : {}),
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
      const stillSelectable = units.find(
        (u) => u.id === userSelected.unitId && canSelectUnit(u),
      );
      return stillSelectable ? userSelected : null;
    }
    if (layer !== "units" || !initialUnitId) {
      return null;
    }
    const match = units.find((u) => u.id === initialUnitId && canSelectUnit(u));
    if (!match) {
      return null;
    }
    return {
      propertyId,
      propertyName,
      unitTypeId,
      unitTypeName,
      defaultPriceIdr: unitTypeRack?.defaultPriceIdr,
      monthlyPriceIdr: unitTypeRack?.monthlyPriceIdr,
      yearlyPriceIdr: unitTypeRack?.yearlyPriceIdr,
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
    unitTypeRack,
  ]);

  const title =
    layer === "properties"
      ? t("reservations:unitPicker.titleProperties")
      : layer === "types"
        ? t("reservations:unitPicker.titleTypes")
        : t("reservations:unitPicker.titleUnits");

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
          ? t("reservations:unitPicker.descriptionWithDates")
          : t("reservations:unitPicker.descriptionNoDates")
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
            {t("reservations:unitPicker.cancel")}
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
              {t("reservations:unitPicker.confirm")}
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
                <BreadcrumbPage>
                  {t("reservations:unitPicker.breadcrumbProperties")}
                </BreadcrumbPage>
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
                      setUnitTypeRack(null);
                      setUserSelected(null);
                    }}
                  >
                    {t("reservations:unitPicker.breadcrumbProperties")}
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
                      {propertyName ||
                        t("reservations:unitPicker.propertyFallback")}
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
                          setUnitTypeRack(null);
                          setUserSelected(null);
                        }}
                      >
                        {propertyName ||
                          t("reservations:unitPicker.propertyFallback")}
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
                    {unitTypeName || t("reservations:unitPicker.typeFallback")}
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
                ? t("reservations:unitPicker.searchPlaceholder.properties")
                : layer === "types"
                  ? t("reservations:unitPicker.searchPlaceholder.types")
                  : t("reservations:unitPicker.searchPlaceholder.units")
            }
            aria-label={t("reservations:unitPicker.searchAria")}
          />
        </InputGroup>

        {activeQuery.isLoading && (
          <ExplorerGridSkeleton view={view} count={5} />
        )}

        {activeQuery.isError && !activeQuery.data && (
          <QueryErrorPanel
            message={t("reservations:unitPicker.loadError")}
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
                <EmptyTitle>
                  {t("reservations:unitPicker.emptyTitle")}
                </EmptyTitle>
                <EmptyDescription>
                  {layer === "units"
                    ? t("reservations:unitPicker.emptyUnitsDescription")
                    : t("reservations:unitPicker.emptySearchDescription")}
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
                  meta={unitCountLabel(property.unitCount)}
                  imageUrl={property.coverImage?.url}
                  canManage={false}
                  badge={
                    !property.isActive ? (
                      <StatusBadge
                        label={t("reservations:unitPicker.inactiveBadge")}
                        tone="muted"
                      />
                    ) : undefined
                  }
                  onSelect={() => {
                    setPropertyId(property.id);
                    setPropertyName(property.name);
                    setUnitTypeId("");
                    setUnitTypeName("");
                    setUnitTypeRack(null);
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
                  meta={`${unitCountLabel(unitType.unitCount)} · ${unitType.code}`}
                  imageUrl={firstImageUrl(unitType.media)}
                  canManage={false}
                  badge={
                    !unitType.isActive ? (
                      <StatusBadge
                        label={t("reservations:unitPicker.inactiveBadge")}
                        tone="muted"
                      />
                    ) : undefined
                  }
                  onSelect={() => {
                    setUnitTypeId(unitType.id);
                    setUnitTypeName(unitType.name);
                    setUnitTypeRack({
                      defaultPriceIdr: unitType.defaultPriceIdr,
                      monthlyPriceIdr: unitType.monthlyPriceIdr,
                      yearlyPriceIdr: unitType.yearlyPriceIdr,
                    });
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
                defaultPriceIdr: unitTypeRack?.defaultPriceIdr,
                monthlyPriceIdr: unitTypeRack?.monthlyPriceIdr,
                yearlyPriceIdr: unitTypeRack?.yearlyPriceIdr,
                unitId: unit.id,
                unitCode: unit.code,
                unitName: unit.name,
              };
              const blocked = blockReasonBadge(unit);
              const selectable = canSelectUnit(unit);
              return (
                <ExplorerItem
                  key={unit.id}
                  view={view}
                  title={unitLabel(unit)}
                  meta={
                    unit.floor
                      ? t("reservations:unitPicker.floorMeta", {
                          floor: unit.floor,
                        })
                      : "—"
                  }
                  canManage={false}
                  disabled={!selectable}
                  selected={selectedUnit?.unitId === unit.id}
                  badge={
                    blocked ? (
                      <StatusBadge label={blocked.label} tone={blocked.tone} />
                    ) : undefined
                  }
                  onSelect={
                    selectable
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
