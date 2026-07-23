import type {
  Paginated,
  StaffUnit,
  StaffUnitAvailability,
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
};

export type UnitUpdateInput = {
  code?: string;
  name?: string | null;
  floor?: string | null;
  status?: UnitStatus;
  notes?: string | null;
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

/** Occupying stays for one calendar month (date-picker blocking). */
export async function getUnitMonthOccupancy(
  unitId: string,
  params: {
    yearMonth: string;
    excludeReservationId?: string;
  },
): Promise<UnitMonthOccupancy> {
  const { data } = await api.get<UnitMonthOccupancy>(
    `/units/${unitId}/occupancy`,
    {
      params: {
        yearMonth: params.yearMonth,
        ...(params.excludeReservationId
          ? { excludeReservationId: params.excludeReservationId }
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

export async function deleteUnit(id: string): Promise<{ ok: true }> {
  const { data } = await api.delete<{ ok: true }>(`/units/${id}`);
  return data;
}
