import type {
  Paginated,
  StaffUnit,
  StaffUnitAvailability,
  StaffUnitIcalFeedInput,
  StayBillingPeriod,
  UnitMonthOccupancy,
  UnitStatus,
} from "@cabin/api-contract";
import { PAGE_SIZE_DEFAULT } from "@cabin/api-contract";
import { api } from "./client";

export type ListUnitsParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  unitTypeId?: string;
  status?: UnitStatus;
};

export type UnitWriteInput = {
  unitTypeId: string;
  code: string;
  name?: string | null;
  floor?: string | null;
  status: UnitStatus;
  notes?: string | null;
  icalFeeds?: StaffUnitIcalFeedInput[];
};

export type UnitUpdateInput = {
  code?: string;
  name?: string | null;
  floor?: string | null;
  status?: UnitStatus;
  notes?: string | null;
  icalFeeds?: StaffUnitIcalFeedInput[];
};

export async function listUnits(
  propertyId: string,
  params: ListUnitsParams = {},
): Promise<Paginated<StaffUnit>> {
  const { data } = await api.get<Paginated<StaffUnit>>(
    `/properties/${propertyId}/units`,
    {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? PAGE_SIZE_DEFAULT,
        ...(params.q ? { q: params.q } : {}),
        ...(params.unitTypeId ? { unitTypeId: params.unitTypeId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
    },
  );
  return data;
}

export async function listAvailableUnits(
  propertyId: string,
  params: {
    checkInDate?: string;
    checkOutDate?: string;
    billingPeriod?: StayBillingPeriod;
    unitTypeId?: string;
    excludeReservationId?: string;
    excludeBlockId?: string;
  } = {},
): Promise<StaffUnitAvailability[]> {
  const { data } = await api.get<StaffUnitAvailability[]>(
    `/properties/${propertyId}/units/availability`,
    {
      params: {
        ...(params.checkInDate ? { checkInDate: params.checkInDate } : {}),
        ...(params.checkOutDate ? { checkOutDate: params.checkOutDate } : {}),
        ...(params.billingPeriod
          ? { billingPeriod: params.billingPeriod }
          : {}),
        ...(params.unitTypeId ? { unitTypeId: params.unitTypeId } : {}),
        ...(params.excludeReservationId
          ? { excludeReservationId: params.excludeReservationId }
          : {}),
        ...(params.excludeBlockId
          ? { excludeBlockId: params.excludeBlockId }
          : {}),
      },
    },
  );
  return data;
}

/** Occupying stays for date-picker blocking (`yearMonth` or `from`+`to`). */
export async function getUnitMonthOccupancy(
  unitId: string,
  params: {
    yearMonth?: string;
    from?: string;
    to?: string;
    excludeReservationId?: string;
    excludeBlockId?: string;
  },
): Promise<UnitMonthOccupancy> {
  const { data } = await api.get<UnitMonthOccupancy>(
    `/units/${unitId}/occupancy`,
    {
      params: {
        ...(params.yearMonth ? { yearMonth: params.yearMonth } : {}),
        ...(params.from && params.to
          ? { from: params.from, to: params.to }
          : {}),
        ...(params.excludeReservationId
          ? { excludeReservationId: params.excludeReservationId }
          : {}),
        ...(params.excludeBlockId
          ? { excludeBlockId: params.excludeBlockId }
          : {}),
      },
    },
  );
  return data;
}

export async function getUnit(id: string): Promise<StaffUnit> {
  const { data } = await api.get<StaffUnit>(`/units/${id}`);
  return data;
}

export async function createUnit(
  propertyId: string,
  input: UnitWriteInput,
): Promise<StaffUnit> {
  const { data } = await api.post<StaffUnit>(
    `/properties/${propertyId}/units`,
    input,
  );
  return data;
}

export async function updateUnit(
  id: string,
  input: UnitUpdateInput,
): Promise<StaffUnit> {
  const { data } = await api.patch<StaffUnit>(`/units/${id}`, input);
  return data;
}

export async function rotateUnitIcalToken(id: string): Promise<StaffUnit> {
  const { data } = await api.post<StaffUnit>(`/units/${id}/rotate-ical-token`);
  return data;
}

export async function deleteUnit(id: string): Promise<{ ok: true }> {
  const { data } = await api.delete<{ ok: true }>(`/units/${id}`);
  return data;
}
