import type {
  Paginated,
  StaffUnit,
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
  isActive?: boolean;
};

export type UnitWriteInput = {
  unitTypeId: string;
  code: string;
  name?: string | null;
  floor?: string | null;
  status: UnitStatus;
  notes?: string | null;
  isActive?: boolean;
};

export type UnitUpdateInput = {
  code?: string;
  name?: string | null;
  floor?: string | null;
  status?: UnitStatus;
  notes?: string | null;
  isActive?: boolean;
};

export async function listUnits(
  propertyId: string,
  params: ListUnitsParams = {},
): Promise<Paginated<StaffUnit>> {
  const { data } = await api.get<Paginated<StaffUnit>>(
    `/staff/properties/${propertyId}/units`,
    {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? PAGE_SIZE_DEFAULT,
        ...(params.q ? { q: params.q } : {}),
        ...(params.unitTypeId ? { unitTypeId: params.unitTypeId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      },
    },
  );
  return data;
}

export async function getUnit(id: string): Promise<StaffUnit> {
  const { data } = await api.get<StaffUnit>(`/staff/units/${id}`);
  return data;
}

export async function createUnit(
  propertyId: string,
  input: UnitWriteInput,
): Promise<StaffUnit> {
  const { data } = await api.post<StaffUnit>(
    `/staff/properties/${propertyId}/units`,
    input,
  );
  return data;
}

export async function updateUnit(
  id: string,
  input: UnitUpdateInput,
): Promise<StaffUnit> {
  const { data } = await api.patch<StaffUnit>(`/staff/units/${id}`, input);
  return data;
}

export async function deleteUnit(id: string): Promise<{ ok: true }> {
  const { data } = await api.delete<{ ok: true }>(`/staff/units/${id}`);
  return data;
}
