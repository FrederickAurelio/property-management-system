// MOCK — in-memory inventory store; replace with API calls + TanStack Query on backend integration.
import { useSyncExternalStore } from "react";
import {
  EMPTY_AMENITIES,
  type InventoryState,
  type Property,
  type Unit,
  type UnitType,
} from "./inventory-types";

// MOCK — client-side timestamp for createdAt/updatedAt until API sets these.
function nowIso(): string {
  return new Date().toISOString();
}

// MOCK — local ID generator; API will return server-assigned IDs.
function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

// MOCK — shared amenity preset reused across seed unit types.
const emptyAmenitiesStudio = {
  highlights: [
    "PRIVATE_KITCHEN",
    "PRIVATE_BATHROOM",
    "BALCONY",
    "CITY_VIEW",
    "POOL_WITH_A_VIEW",
    "AIR_CONDITIONING",
    "FLAT_SCREEN_TV",
    "SOUNDPROOFING",
    "TERRACE",
    "FREE_WIFI",
  ],
  kitchen: ["REFRIGERATOR", "KITCHENWARE", "ELECTRIC_KETTLE", "STOVETOP"],
  bathroom: ["SHOWER", "BIDET"],
  view: ["BALCONY", "TERRACE", "CITY_VIEW"],
  facilities: [
    "ELEVATOR_ACCESS",
    "FLAT_SCREEN_TV",
    "TOWELS",
    "WHEELCHAIR_ACCESSIBLE",
    "SEATING_AREA",
    "SOCKET_NEAR_BED",
    "LINEN",
    "TILE_MARBLE_FLOOR",
    "WARDROBE",
    "CLEANING_PRODUCTS",
    "SOUNDPROOFING",
    "AIR_CONDITIONING",
  ],
};

// MOCK — stable seed IDs so drill-down routes work across reloads.
const skybreezeId = "prop_skybreeze";
const twoBrId = "type_two_br";
const threeBrId = "type_three_br";
const kingId = "type_dlx_king";
const queenId = "type_dlx_queen";
const studioId = "type_dlx_studio";
const cabinLakeId = "prop_cabin_lake";

// MOCK — demo properties, unit types, and units for UI development.
const seed: InventoryState = {
  properties: [
    {
      id: skybreezeId,
      code: "SKYBREEZE_SENTRALAND",
      name: "Skybreeze Sentraland",
      timezone: "Asia/Jakarta",
      checkInFrom: "15:00",
      checkInUntil: "23:30",
      checkOutFrom: "08:00",
      checkOutUntil: "12:00",
      addressLine: "Apartemen Sentraland Medan Tower Barcelona",
      city: "Medan",
      countryCode: "ID",
      coverImage: {
        id: "cover_skybreeze",
        kind: "IMAGE",
        url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
        name: "Skybreeze cover",
        mimeType: "image/jpeg",
      },
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: cabinLakeId,
      code: "CABIN_LAKE_HOUSE",
      name: "Cabin Lake House",
      timezone: "Asia/Jakarta",
      checkInFrom: "14:00",
      checkInUntil: null,
      checkOutFrom: null,
      checkOutUntil: "11:00",
      addressLine: null,
      city: "Berastagi",
      countryCode: "ID",
      coverImage: {
        id: "cover_cabin",
        kind: "IMAGE",
        url: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800&q=80",
        name: "Cabin cover",
        mimeType: "image/jpeg",
      },
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  unitTypes: [
    {
      id: twoBrId,
      propertyId: skybreezeId,
      code: "TWO_BR_STD",
      name: "Two-Bedroom Standard Apartment",
      layout: "APARTMENT",
      sizeSqm: 36,
      bedroomCount: 2,
      bathroomCount: 1,
      maxGuests: 3,
      bedConfig: [
        { room: "Bedroom 1", beds: [{ type: "DOUBLE", count: 1 }] },
        { room: "Bedroom 2", beds: [{ type: "SINGLE", count: 1 }] },
      ],
      amenities: { ...emptyAmenitiesStudio, highlights: emptyAmenitiesStudio.highlights.filter((h) => h !== "POOL_WITH_A_VIEW") },
      media: [
        { id: "m_two_1", kind: "IMAGE", url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80", name: "Living room", mimeType: "image/jpeg" },
        { id: "m_two_2", kind: "IMAGE", url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80", name: "Bedroom", mimeType: "image/jpeg" },
      ],
      description: null,
      smokingAllowed: false,
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: threeBrId,
      propertyId: skybreezeId,
      code: "THREE_BR_STD",
      name: "Three-Bedroom Standard Apartment",
      layout: "APARTMENT",
      sizeSqm: 54,
      bedroomCount: 3,
      bathroomCount: 1,
      maxGuests: 3,
      bedConfig: [
        { room: "Bedroom 1", beds: [{ type: "DOUBLE", count: 1 }] },
        { room: "Bedroom 2", beds: [{ type: "SINGLE", count: 1 }] },
        { room: "Bedroom 3", beds: [{ type: "SINGLE", count: 1 }] },
      ],
      amenities: { ...emptyAmenitiesStudio, highlights: emptyAmenitiesStudio.highlights.filter((h) => h !== "POOL_WITH_A_VIEW") },
      media: [
        { id: "m_three_1", kind: "IMAGE", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80", name: "Apartment", mimeType: "image/jpeg" },
      ],
      description: null,
      smokingAllowed: false,
      sortOrder: 2,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: kingId,
      propertyId: skybreezeId,
      code: "DLX_KING_STUDIO",
      name: "Deluxe King Studio",
      layout: "STUDIO",
      sizeSqm: 21,
      bedroomCount: 0,
      bathroomCount: 1,
      maxGuests: 2,
      bedConfig: [
        { room: "Studio", beds: [{ type: "LARGE_DOUBLE", count: 1 }] },
      ],
      amenities: emptyAmenitiesStudio,
      media: [
        { id: "m_king_1", kind: "IMAGE", url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80", name: "King studio", mimeType: "image/jpeg" },
      ],
      description: null,
      smokingAllowed: false,
      sortOrder: 3,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: queenId,
      propertyId: skybreezeId,
      code: "DLX_QUEEN_STUDIO",
      name: "Deluxe Queen Studio",
      layout: "STUDIO",
      sizeSqm: 18,
      bedroomCount: 0,
      bathroomCount: 1,
      maxGuests: 2,
      bedConfig: [
        { room: "Studio", beds: [{ type: "LARGE_DOUBLE", count: 1 }] },
      ],
      amenities: emptyAmenitiesStudio,
      media: [
        { id: "m_queen_1", kind: "IMAGE", url: "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80", name: "Queen studio", mimeType: "image/jpeg" },
      ],
      description: null,
      smokingAllowed: false,
      sortOrder: 4,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: studioId,
      propertyId: skybreezeId,
      code: "DLX_STUDIO",
      name: "Deluxe Studio",
      layout: "STUDIO",
      sizeSqm: 18,
      bedroomCount: 0,
      bathroomCount: 1,
      maxGuests: 2,
      bedConfig: [
        { room: "Studio", beds: [{ type: "LARGE_DOUBLE", count: 1 }] },
      ],
      amenities: emptyAmenitiesStudio,
      media: [
        { id: "m_studio_1", kind: "IMAGE", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80", name: "Studio", mimeType: "image/jpeg" },
        { id: "m_studio_2", kind: "IMAGE", url: "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&q=80", name: "Kitchen", mimeType: "image/jpeg" },
      ],
      description:
        "The pool with a view is a top feature of this studio. Entire studio 18 m².",
      smokingAllowed: false,
      sortOrder: 5,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "type_lake_cabin",
      propertyId: cabinLakeId,
      code: "LAKE_CABIN",
      name: "Lake Cabin",
      layout: "CABIN",
      sizeSqm: 42,
      bedroomCount: 1,
      bathroomCount: 1,
      maxGuests: 2,
      bedConfig: [
        { room: "Bedroom 1", beds: [{ type: "QUEEN", count: 1 }] },
      ],
      amenities: EMPTY_AMENITIES,
      media: [
        { id: "m_cabin_1", kind: "IMAGE", url: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80", name: "Cabin exterior", mimeType: "image/jpeg" },
      ],
      description: null,
      smokingAllowed: false,
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  units: [
    {
      id: "unit_b0801",
      propertyId: skybreezeId,
      unitTypeId: twoBrId,
      code: "B-0801",
      name: null,
      floor: "8",
      status: "ACTIVE",
      notes: null,
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "unit_b0802",
      propertyId: skybreezeId,
      unitTypeId: twoBrId,
      code: "B-0802",
      name: null,
      floor: "8",
      status: "ACTIVE",
      notes: null,
      sortOrder: 2,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "unit_b0803",
      propertyId: skybreezeId,
      unitTypeId: twoBrId,
      code: "B-0803",
      name: null,
      floor: "8",
      status: "MAINTENANCE",
      notes: "AC servicing",
      sortOrder: 3,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "unit_b1201",
      propertyId: skybreezeId,
      unitTypeId: threeBrId,
      code: "B-1201",
      name: null,
      floor: "12",
      status: "ACTIVE",
      notes: null,
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "unit_ds0501",
      propertyId: skybreezeId,
      unitTypeId: kingId,
      code: "DS-0501",
      name: null,
      floor: "5",
      status: "ACTIVE",
      notes: null,
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "unit_dq0701",
      propertyId: skybreezeId,
      unitTypeId: queenId,
      code: "DQ-0701",
      name: null,
      floor: "7",
      status: "ACTIVE",
      notes: null,
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "unit_ds0901",
      propertyId: skybreezeId,
      unitTypeId: studioId,
      code: "DS-0901",
      name: null,
      floor: "9",
      status: "ACTIVE",
      notes: null,
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "unit_ds0902",
      propertyId: skybreezeId,
      unitTypeId: studioId,
      code: "DS-0902",
      name: null,
      floor: "9",
      status: "INACTIVE",
      notes: "Offline for renovation",
      sortOrder: 2,
      isActive: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "unit_cabin01",
      propertyId: cabinLakeId,
      unitTypeId: "type_lake_cabin",
      code: "CABIN-01",
      name: "Cabin 01",
      floor: null,
      status: "ACTIVE",
      notes: null,
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "unit_cabin02",
      propertyId: cabinLakeId,
      unitTypeId: "type_lake_cabin",
      code: "CABIN-02",
      name: "Cabin 02",
      floor: null,
      status: "ACTIVE",
      notes: null,
      sortOrder: 2,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

// MOCK — mutable in-memory state; API will be source of truth in Postgres.
let state: InventoryState = structuredClone(seed);
// MOCK — subscriber set for useSyncExternalStore re-renders.
const listeners = new Set<() => void>();

// MOCK — notify React subscribers after local state mutation.
function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

// MOCK — write to in-memory store and trigger re-render.
function setState(next: InventoryState): void {
  state = next;
  emit();
}

// MOCK — snapshot reader for useSyncExternalStore; replace with query cache read.
export function getInventorySnapshot(): InventoryState {
  return state;
}

// MOCK — subscribe to in-memory changes; replace with query invalidation.
export function subscribeInventory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// MOCK — React hook over local store; replace with useQuery per list/detail.
export function useInventory(): InventoryState {
  return useSyncExternalStore(subscribeInventory, getInventorySnapshot);
}

// MOCK — create-property form payload; align with API DTO when wired.
export type PropertyInput = {
  code: string;
  name: string;
  timezone: string;
  city?: string | null;
  countryCode?: string | null;
  addressLine?: string | null;
  checkInFrom?: string | null;
  checkInUntil?: string | null;
  checkOutFrom?: string | null;
  checkOutUntil?: string | null;
  coverImage?: Property["coverImage"];
  isActive?: boolean;
};

// MOCK — create/update unit-type form payload; align with API DTO when wired.
export type UnitTypeInput = {
  code: string;
  name: string;
  layout: UnitType["layout"];
  sizeSqm?: number | null;
  bedroomCount: number;
  bathroomCount: number;
  maxGuests: number;
  bedConfig?: UnitType["bedConfig"];
  amenities?: UnitType["amenities"];
  media?: UnitType["media"];
  smokingAllowed?: boolean;
  isActive?: boolean;
  description?: string | null;
};

// MOCK — create/update unit form payload; align with API DTO when wired.
export type UnitInput = {
  code: string;
  name?: string | null;
  floor?: string | null;
  status: Unit["status"];
  notes?: string | null;
  isActive?: boolean;
};

// MOCK — stands in for API conflict/validation errors until envelope is wired.
export class InventoryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryConflictError";
  }
}

// MOCK — local create; replace with POST /properties.
export function createProperty(input: PropertyInput): Property {
  const code = input.code.trim().toUpperCase();
  if (state.properties.some((p) => p.code === code)) {
    throw new InventoryConflictError("A property with this code already exists");
  }
  const ts = nowIso();
  const property: Property = {
    id: newId("prop"),
    code,
    name: input.name.trim(),
    timezone: input.timezone.trim() || "Asia/Jakarta",
    checkInFrom: input.checkInFrom ?? null,
    checkInUntil: input.checkInUntil ?? null,
    checkOutFrom: input.checkOutFrom ?? null,
    checkOutUntil: input.checkOutUntil ?? null,
    addressLine: input.addressLine?.trim() || null,
    city: input.city?.trim() || null,
    countryCode: input.countryCode?.trim().toUpperCase() || null,
    coverImage: input.coverImage ?? null,
    isActive: input.isActive ?? true,
    createdAt: ts,
    updatedAt: ts,
  };
  setState({ ...state, properties: [...state.properties, property] });
  return property;
}

// MOCK — local update; replace with PATCH /properties/:id.
export function updateProperty(id: string, input: PropertyInput): Property {
  const existing = state.properties.find((p) => p.id === id);
  if (!existing) {
    throw new InventoryConflictError("Property not found");
  }
  const code = input.code.trim().toUpperCase();
  if (state.properties.some((p) => p.code === code && p.id !== id)) {
    throw new InventoryConflictError("A property with this code already exists");
  }
  const updated: Property = {
    ...existing,
    code,
    name: input.name.trim(),
    timezone: input.timezone.trim() || existing.timezone,
    checkInFrom: input.checkInFrom ?? null,
    checkInUntil: input.checkInUntil ?? null,
    checkOutFrom: input.checkOutFrom ?? null,
    checkOutUntil: input.checkOutUntil ?? null,
    addressLine: input.addressLine?.trim() || null,
    city: input.city?.trim() || null,
    countryCode: input.countryCode?.trim().toUpperCase() || null,
    coverImage:
      input.coverImage !== undefined ? input.coverImage : existing.coverImage,
    isActive: input.isActive ?? existing.isActive,
    updatedAt: nowIso(),
  };
  setState({
    ...state,
    properties: state.properties.map((p) => (p.id === id ? updated : p)),
  });
  return updated;
}

// MOCK — local delete; replace with DELETE /properties/:id.
export function deleteProperty(id: string): void {
  const typeCount = state.unitTypes.filter((t) => t.propertyId === id).length;
  const unitCount = state.units.filter((u) => u.propertyId === id).length;
  if (typeCount > 0 || unitCount > 0) {
    throw new InventoryConflictError(
      `Cannot delete: ${typeCount} type(s) and ${unitCount} unit(s) still belong to this property`,
    );
  }
  setState({
    ...state,
    properties: state.properties.filter((p) => p.id !== id),
  });
}

// MOCK — local create; replace with POST /properties/:propertyId/unit-types.
export function createUnitType(
  propertyId: string,
  input: UnitTypeInput,
): UnitType {
  if (!state.properties.some((p) => p.id === propertyId)) {
    throw new InventoryConflictError("Property not found");
  }
  const code = input.code.trim().toUpperCase();
  if (
    state.unitTypes.some((t) => t.propertyId === propertyId && t.code === code)
  ) {
    throw new InventoryConflictError(
      "A unit type with this code already exists on this property",
    );
  }
  const ts = nowIso();
  const maxSort = state.unitTypes
    .filter((t) => t.propertyId === propertyId)
    .reduce((max, t) => Math.max(max, t.sortOrder), 0);
  const unitType: UnitType = {
    id: newId("type"),
    propertyId,
    code,
    name: input.name.trim(),
    layout: input.layout,
    sizeSqm: input.sizeSqm ?? null,
    bedroomCount: input.bedroomCount,
    bathroomCount: input.bathroomCount,
    maxGuests: input.maxGuests,
    bedConfig: input.bedConfig ?? [],
    amenities: input.amenities
      ? structuredClone(input.amenities)
      : structuredClone(EMPTY_AMENITIES),
    media: input.media ? structuredClone(input.media) : [],
    description: input.description?.trim() || null,
    smokingAllowed: input.smokingAllowed ?? false,
    sortOrder: maxSort + 1,
    isActive: input.isActive ?? true,
    createdAt: ts,
    updatedAt: ts,
  };
  setState({ ...state, unitTypes: [...state.unitTypes, unitType] });
  return unitType;
}

// MOCK — local update; replace with PATCH /unit-types/:id.
export function updateUnitType(id: string, input: UnitTypeInput): UnitType {
  const existing = state.unitTypes.find((t) => t.id === id);
  if (!existing) {
    throw new InventoryConflictError("Unit type not found");
  }
  const code = input.code.trim().toUpperCase();
  if (
    state.unitTypes.some(
      (t) =>
        t.propertyId === existing.propertyId && t.code === code && t.id !== id,
    )
  ) {
    throw new InventoryConflictError(
      "A unit type with this code already exists on this property",
    );
  }
  const updated: UnitType = {
    ...existing,
    code,
    name: input.name.trim(),
    layout: input.layout,
    sizeSqm: input.sizeSqm ?? null,
    bedroomCount: input.bedroomCount,
    bathroomCount: input.bathroomCount,
    maxGuests: input.maxGuests,
    bedConfig: input.bedConfig ?? existing.bedConfig,
    amenities: input.amenities
      ? structuredClone(input.amenities)
      : existing.amenities,
    media: input.media ? structuredClone(input.media) : existing.media,
    description: input.description?.trim() || null,
    smokingAllowed: input.smokingAllowed ?? existing.smokingAllowed,
    isActive: input.isActive ?? existing.isActive,
    updatedAt: nowIso(),
  };
  setState({
    ...state,
    unitTypes: state.unitTypes.map((t) => (t.id === id ? updated : t)),
  });
  return updated;
}

// MOCK — local delete; replace with DELETE /unit-types/:id.
export function deleteUnitType(id: string): void {
  const unitCount = state.units.filter((u) => u.unitTypeId === id).length;
  if (unitCount > 0) {
    throw new InventoryConflictError(
      `Cannot delete: ${unitCount} unit(s) still use this type`,
    );
  }
  setState({
    ...state,
    unitTypes: state.unitTypes.filter((t) => t.id !== id),
  });
}

// MOCK — local create; replace with POST /properties/:propertyId/units.
export function createUnit(
  propertyId: string,
  unitTypeId: string,
  input: UnitInput,
): Unit {
  const unitType = state.unitTypes.find((t) => t.id === unitTypeId);
  if (!unitType || unitType.propertyId !== propertyId) {
    throw new InventoryConflictError("Unit type not found on this property");
  }
  const code = input.code.trim().toUpperCase();
  if (state.units.some((u) => u.propertyId === propertyId && u.code === code)) {
    throw new InventoryConflictError(
      "A unit with this code already exists on this property",
    );
  }
  const ts = nowIso();
  const maxSort = state.units
    .filter((u) => u.unitTypeId === unitTypeId)
    .reduce((max, u) => Math.max(max, u.sortOrder), 0);
  const unit: Unit = {
    id: newId("unit"),
    propertyId,
    unitTypeId,
    code,
    name: input.name?.trim() || null,
    floor: input.floor?.trim() || null,
    status: input.status,
    notes: input.notes?.trim() || null,
    sortOrder: maxSort + 1,
    isActive: input.isActive ?? true,
    createdAt: ts,
    updatedAt: ts,
  };
  setState({ ...state, units: [...state.units, unit] });
  return unit;
}

// MOCK — local update; replace with PATCH /units/:id.
export function updateUnit(id: string, input: UnitInput): Unit {
  const existing = state.units.find((u) => u.id === id);
  if (!existing) {
    throw new InventoryConflictError("Unit not found");
  }
  const code = input.code.trim().toUpperCase();
  if (
    state.units.some(
      (u) =>
        u.propertyId === existing.propertyId && u.code === code && u.id !== id,
    )
  ) {
    throw new InventoryConflictError(
      "A unit with this code already exists on this property",
    );
  }
  const updated: Unit = {
    ...existing,
    code,
    name: input.name?.trim() || null,
    floor: input.floor?.trim() || null,
    status: input.status,
    notes: input.notes?.trim() || null,
    isActive: input.isActive ?? existing.isActive,
    updatedAt: nowIso(),
  };
  setState({
    ...state,
    units: state.units.map((u) => (u.id === id ? updated : u)),
  });
  return updated;
}

// MOCK — local delete; replace with DELETE /units/:id.
export function deleteUnit(id: string): void {
  if (!state.units.some((u) => u.id === id)) {
    throw new InventoryConflictError("Unit not found");
  }
  setState({
    ...state,
    units: state.units.filter((u) => u.id !== id),
  });
}

// MOCK — client-side count; API list should return typeCount metadata instead.
export function countTypesForProperty(propertyId: string): number {
  return state.unitTypes.filter((t) => t.propertyId === propertyId).length;
}

// MOCK — client-side count; API list should return unitCount metadata instead.
export function countUnitsForProperty(propertyId: string): number {
  return state.units.filter((u) => u.propertyId === propertyId).length;
}

// MOCK — client-side count; API list should return unitCount per type instead.
export function countUnitsForType(unitTypeId: string): number {
  return state.units.filter((u) => u.unitTypeId === unitTypeId).length;
}
