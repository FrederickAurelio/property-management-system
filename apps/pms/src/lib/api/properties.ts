import type {
  MediaItem,
  Paginated,
  StaffProperty,
} from "@cabin/api-contract";
import { PAGE_SIZE_DEFAULT } from "@cabin/api-contract";
import { api } from "./client";

export type ListPropertiesParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  isActive?: boolean;
};

export type PropertyWriteInput = {
  code: string;
  name: string;
  timezone: string;
  checkInFrom?: string | null;
  checkInUntil?: string | null;
  checkOutFrom?: string | null;
  checkOutUntil?: string | null;
  addressLine?: string | null;
  city?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googlePlaceId?: string | null;
  coverImage?: MediaItem | null;
  isActive?: boolean;
};

export async function listProperties(
  params: ListPropertiesParams = {},
): Promise<Paginated<StaffProperty>> {
  const { data } = await api.get<Paginated<StaffProperty>>("/staff/properties", {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? PAGE_SIZE_DEFAULT,
      ...(params.q ? { q: params.q } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    },
  });
  return data;
}

export async function getProperty(id: string): Promise<StaffProperty> {
  const { data } = await api.get<StaffProperty>(`/staff/properties/${id}`);
  return data;
}

export async function createProperty(
  input: PropertyWriteInput,
): Promise<StaffProperty> {
  const { data } = await api.post<StaffProperty>("/staff/properties", input);
  return data;
}

export async function updateProperty(
  id: string,
  input: Partial<PropertyWriteInput>,
): Promise<StaffProperty> {
  const { data } = await api.patch<StaffProperty>(
    `/staff/properties/${id}`,
    input,
  );
  return data;
}

export async function deleteProperty(id: string): Promise<{ ok: true }> {
  const { data } = await api.delete<{ ok: true }>(`/staff/properties/${id}`);
  return data;
}
