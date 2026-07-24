import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type {
  Paginated,
  StaffProperty,
  StaffUnitType,
  StaffUnitTypeRack,
} from "@cabin/api-contract";
import {
  staffPropertiesQueryKeyPrefix,
  staffPropertyQueryKey,
  staffUnitTypeQueryKey,
  staffUnitTypeRackQueryKey,
  staffUnitTypesQueryKeyPrefix,
} from "@/lib/api";

/** Carried on React Router `Link`/`navigate` state when drilling parent → child. */
export type ExplorerNavState = {
  propertyName?: string;
  unitTypeName?: string;
};

export function parseExplorerNavState(state: unknown): ExplorerNavState {
  if (!state || typeof state !== "object") {
    return {};
  }
  const record = state as Record<string, unknown>;
  return {
    propertyName:
      typeof record.propertyName === "string" ? record.propertyName : undefined,
    unitTypeName:
      typeof record.unitTypeName === "string" ? record.unitTypeName : undefined,
  };
}

function pagesItems<T>(data: InfiniteData<Paginated<T>> | undefined): T[] {
  if (!data?.pages) {
    return [];
  }
  return data.pages.flatMap((page) => page.items);
}

/** Resolve a property display name from detail or any cached infinite list. */
export function findStaffPropertyName(
  queryClient: QueryClient,
  propertyId: string,
): string | undefined {
  const detail = queryClient.getQueryData<StaffProperty>(
    staffPropertyQueryKey(propertyId),
  );
  if (detail?.name) {
    return detail.name;
  }

  const lists = queryClient.getQueriesData<
    InfiniteData<Paginated<StaffProperty>>
  >({ queryKey: staffPropertiesQueryKeyPrefix });

  for (const [, data] of lists) {
    const hit = pagesItems(data).find((item) => item.id === propertyId);
    if (hit?.name) {
      return hit.name;
    }
  }
  return undefined;
}

/** Resolve a unit-type display name from detail or any cached infinite list. */
export function findStaffUnitTypeName(
  queryClient: QueryClient,
  unitTypeId: string,
): string | undefined {
  const detail = queryClient.getQueryData<StaffUnitType>(
    staffUnitTypeQueryKey(unitTypeId),
  );
  if (detail?.name) {
    return detail.name;
  }

  const lists = queryClient.getQueriesData<
    InfiniteData<Paginated<StaffUnitType>>
  >({ queryKey: staffUnitTypesQueryKeyPrefix });

  for (const [, data] of lists) {
    const hit = pagesItems(data).find((item) => item.id === unitTypeId);
    if (hit?.name) {
      return hit.name;
    }
  }
  return undefined;
}

/** Resolve full rack from rack/detail cache or any cached unit-type list. */
export function findStaffUnitTypeRack(
  queryClient: QueryClient,
  unitTypeId: string,
): StaffUnitTypeRack | undefined {
  const rack = queryClient.getQueryData<StaffUnitTypeRack>(
    staffUnitTypeRackQueryKey(unitTypeId),
  );
  if (
    rack != null &&
    Number.isFinite(rack.defaultPriceIdr) &&
    Number.isFinite(rack.monthlyPriceIdr) &&
    Number.isFinite(rack.yearlyPriceIdr)
  ) {
    return rack;
  }

  const detail = queryClient.getQueryData<StaffUnitType>(
    staffUnitTypeQueryKey(unitTypeId),
  );
  if (
    detail != null &&
    Number.isFinite(detail.defaultPriceIdr) &&
    Number.isFinite(detail.monthlyPriceIdr) &&
    Number.isFinite(detail.yearlyPriceIdr)
  ) {
    return {
      id: detail.id,
      defaultPriceIdr: detail.defaultPriceIdr,
      monthlyPriceIdr: detail.monthlyPriceIdr,
      yearlyPriceIdr: detail.yearlyPriceIdr,
    };
  }

  const lists = queryClient.getQueriesData<
    InfiniteData<Paginated<StaffUnitType>>
  >({ queryKey: staffUnitTypesQueryKeyPrefix });

  for (const [, data] of lists) {
    const hit = pagesItems(data).find((item) => item.id === unitTypeId);
    if (
      hit != null &&
      Number.isFinite(hit.defaultPriceIdr) &&
      Number.isFinite(hit.monthlyPriceIdr) &&
      Number.isFinite(hit.yearlyPriceIdr)
    ) {
      return {
        id: hit.id,
        defaultPriceIdr: hit.defaultPriceIdr,
        monthlyPriceIdr: hit.monthlyPriceIdr,
        yearlyPriceIdr: hit.yearlyPriceIdr,
      };
    }
  }
  return undefined;
}

/** @deprecated Prefer `findStaffUnitTypeRack` — kept for daily-only callers. */
export function findStaffUnitTypeDefaultPriceIdr(
  queryClient: QueryClient,
  unitTypeId: string,
): number | undefined {
  return findStaffUnitTypeRack(queryClient, unitTypeId)?.defaultPriceIdr;
}
