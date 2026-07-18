/** Demo inventory fixture — not imported by runtime screens (API is source of truth). */
import { EMPTY_AMENITIES, type MediaItem } from "@cabin/api-contract";

type SeedProperty = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  checkInFrom: string | null;
  checkInUntil: string | null;
  checkOutFrom: string | null;
  checkOutUntil: string | null;
  addressLine: string | null;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  coverImage: MediaItem | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type SeedUnitType = {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  layout: "STUDIO" | "APARTMENT" | "CABIN" | "OTHER";
  sizeSqm: number | null;
  bedroomCount: number;
  bathroomCount: number;
  maxGuests: number;
  defaultPriceIdr: number;
  bedConfig: { room: string; beds: { type: string; count: number }[] }[];
  amenities: typeof EMPTY_AMENITIES;
  media: MediaItem[];
  description: string | null;
  smokingAllowed: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type SeedUnit = {
  id: string;
  propertyId: string;
  unitTypeId: string;
  code: string;
  name: string | null;
  floor: string | null;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  notes: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventorySeed = {
  properties: SeedProperty[];
  unitTypes: SeedUnitType[];
  units: SeedUnit[];
};

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
export const inventorySeed: InventorySeed = {
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
      addressLine:
        "Jl. Nikel, Sukaramai II, Kec. Medan Area, Kota Medan, Sumatera Utara 20224",
      city: "Medan",
      countryCode: "ID",
      latitude: 3.5858139,
      longitude: 98.7040167,
      googlePlaceId: "ChIJDQnc_KkxMTAR4tzfa3cP0Yw",
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
      latitude: 3.1944,
      longitude: 98.5089,
      googlePlaceId: null,
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
      defaultPriceIdr: 650_000,
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
      defaultPriceIdr: 850_000,
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
      defaultPriceIdr: 550_000,
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
      defaultPriceIdr: 450_000,
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
      defaultPriceIdr: 400_000,
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
      defaultPriceIdr: 750_000,
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

