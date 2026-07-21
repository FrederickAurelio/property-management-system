import type {
  StaffProperty,
  StaffUnit,
  StaffUnitType,
} from "@cabin/api-contract";
import type { QueryClient } from "@tanstack/react-query";
import {
  staffPropertiesListQueryKeyPrefix,
  staffPropertiesOptionsQueryKey,
  staffPropertiesQueryKeyPrefix,
  staffPropertyQueryKey,
  staffUnitQueryKey,
  staffUnitTypeQueryKey,
  staffUnitTypesListQueryKeyPrefix,
  staffUnitTypesQueryKeyPrefix,
  staffUnitsAvailabilityQueryKeyPrefix,
  staffUnitsListQueryKeyPrefix,
  staffUnitsOccupancyQueryKeyPrefix,
  staffUnitsQueryKeyPrefix,
} from "./query-keys";

/**
 * After property create/update — mutation body is 1:1 with GET detail.
 * Lists/options still invalidate (infinite pages + filter cards).
 */
export function syncPropertyCaches(
  queryClient: QueryClient,
  property: StaffProperty,
): void {
  queryClient.setQueryData(staffPropertyQueryKey(property.id), property);
  void queryClient.invalidateQueries({
    queryKey: staffPropertiesListQueryKeyPrefix,
  });
  void queryClient.invalidateQueries({
    queryKey: staffPropertiesOptionsQueryKey(),
  });
}

/**
 * After unit-type create/update — detail from response; refresh lists + parent counts.
 */
export function syncUnitTypeCaches(
  queryClient: QueryClient,
  unitType: StaffUnitType,
): void {
  queryClient.setQueryData(staffUnitTypeQueryKey(unitType.id), unitType);
  void queryClient.invalidateQueries({
    queryKey: staffUnitTypesListQueryKeyPrefix,
  });
  void queryClient.invalidateQueries({
    queryKey: staffPropertyQueryKey(unitType.propertyId),
  });
  void queryClient.invalidateQueries({
    queryKey: staffPropertiesListQueryKeyPrefix,
  });
}

/**
 * After unit create/update — detail from response; refresh lists + parent counts.
 * Pass `bookabilityChanged` when status (or create) may change Choose-unit / date blocks.
 */
export function syncUnitCaches(
  queryClient: QueryClient,
  unit: StaffUnit,
  opts: { bookabilityChanged?: boolean } = {},
): void {
  queryClient.setQueryData(staffUnitQueryKey(unit.id), unit);
  void queryClient.invalidateQueries({
    queryKey: staffUnitsListQueryKeyPrefix,
  });
  void queryClient.invalidateQueries({
    queryKey: staffPropertyQueryKey(unit.propertyId),
  });
  void queryClient.invalidateQueries({
    queryKey: staffUnitTypeQueryKey(unit.unitTypeId),
  });
  void queryClient.invalidateQueries({
    queryKey: staffPropertiesListQueryKeyPrefix,
  });
  if (opts.bookabilityChanged) {
    void queryClient.invalidateQueries({
      queryKey: staffUnitsAvailabilityQueryKeyPrefix,
    });
    void queryClient.invalidateQueries({
      queryKey: staffUnitsOccupancyQueryKeyPrefix,
    });
  }
}

/**
 * Delete / tree-shaped inventory changes — no full row to write; bust related caches.
 * Prefer `sync*Caches` when the mutation returns the updated entity.
 */
export function invalidateInventoryCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    queryKey: staffPropertiesQueryKeyPrefix,
  });
  void queryClient.invalidateQueries({
    queryKey: staffUnitTypesQueryKeyPrefix,
  });
  void queryClient.invalidateQueries({
    queryKey: staffUnitsQueryKeyPrefix,
  });
}
