import type {
  Amenities,
  BedConfigRoom,
  MediaItem,
  Paginated,
  StaffUnitType,
  StaffUnitTypeRack,
  UnitLayout,
} from "@cabin/api-contract";
import { PAGE_SIZE_DEFAULT } from "@cabin/api-contract";
import { api } from "./client";

export type ListUnitTypesParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  isActive?: boolean;
};

export type UnitTypeWriteInput = {
  code: string;
  name: string;
  layout: UnitLayout;
  sizeSqm?: number | null;
  bathroomCount: number;
  maxGuests: number;
  defaultPriceIdr: number;
  monthlyPriceIdr: number;
  yearlyPriceIdr: number;
  electricityRateIdrPerKwh?: number;
  waterRateIdrPerM3?: number;
  maintenanceFeeIdrPerMonth?: number;
  bedConfig?: BedConfigRoom[];
  amenities?: Amenities;
  media?: MediaItem[];
  description?: string | null;
  smokingAllowed?: boolean;
  isActive?: boolean;
};

export async function listUnitTypes(
  propertyId: string,
  params: ListUnitTypesParams = {},
): Promise<Paginated<StaffUnitType>> {
  const { data } = await api.get<Paginated<StaffUnitType>>(
    `/properties/${propertyId}/unit-types`,
    {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? PAGE_SIZE_DEFAULT,
        ...(params.q ? { q: params.q } : {}),
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      },
    },
  );
  return data;
}

export async function getUnitType(id: string): Promise<StaffUnitType> {
  const { data } = await api.get<StaffUnitType>(`/unit-types/${id}`);
  return data;
}

export async function getUnitTypeRack(id: string): Promise<StaffUnitTypeRack> {
  const { data } = await api.get<StaffUnitTypeRack>(`/unit-types/${id}/rack`);
  return data;
}

export async function createUnitType(
  propertyId: string,
  input: UnitTypeWriteInput,
): Promise<StaffUnitType> {
  const { data } = await api.post<StaffUnitType>(
    `/properties/${propertyId}/unit-types`,
    input,
  );
  return data;
}

export async function updateUnitType(
  id: string,
  input: Partial<UnitTypeWriteInput>,
): Promise<StaffUnitType> {
  const { data } = await api.patch<StaffUnitType>(`/unit-types/${id}`, input);
  return data;
}

export async function deleteUnitType(id: string): Promise<{ ok: true }> {
  const { data } = await api.delete<{ ok: true }>(`/unit-types/${id}`);
  return data;
}
