/** Keep in sync with Prisma `UnitStatus`. */
export const UnitStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  MAINTENANCE: 'MAINTENANCE',
} as const;

export type UnitStatus = (typeof UnitStatus)[keyof typeof UnitStatus];

/** Keep in sync with Prisma `UnitLayout`. */
export const UnitLayout = {
  STUDIO: 'STUDIO',
  APARTMENT: 'APARTMENT',
  CABIN: 'CABIN',
  OTHER: 'OTHER',
} as const;

export type UnitLayout = (typeof UnitLayout)[keyof typeof UnitLayout];

/** Keep in sync with Prisma `BedKind` (json bedConfig). */
export const BedKind = {
  SINGLE: 'SINGLE',
  DOUBLE: 'DOUBLE',
  LARGE_DOUBLE: 'LARGE_DOUBLE',
  QUEEN: 'QUEEN',
  KING: 'KING',
  SOFA_BED: 'SOFA_BED',
  OTHER: 'OTHER',
} as const;

export type BedKind = (typeof BedKind)[keyof typeof BedKind];

export const MediaKind = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
} as const;

export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];

/** CDN / object-storage media reference — Nest does not serve bytes. */
export type MediaItem = {
  id: string;
  kind: MediaKind;
  url: string;
  name: string;
  mimeType: string;
};

/** Media upload bounds (staff → Cloudinary; Nest validates intent). */
export const MEDIA_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_VIDEO_MAX_BYTES = 30 * 1024 * 1024;
export const MEDIA_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const MEDIA_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;
export const MEDIA_GALLERY_MAX_ITEMS = 20;
export const MEDIA_IMAGE_MAX_EDGE_PX = 1920;

export type MediaImageMimeType = (typeof MEDIA_IMAGE_MIME_TYPES)[number];
export type MediaVideoMimeType = (typeof MEDIA_VIDEO_MIME_TYPES)[number];

/** Nest → PMS: signed Cloudinary browser upload (secret never leaves Nest). */
export type MediaUploadIntent = {
  id: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  resourceType: 'image' | 'video';
  /** Included in signature when set — apply on Cloudinary upload. */
  transformation?: string;
};

export type BedRow = {
  type: BedKind;
  count: number;
};

export type BedConfigRoom = {
  room: string;
  beds: BedRow[];
};

/** Grouped amenity codes (SCREAMING_SNAKE). Unknown codes allowed on write. */
export type Amenities = {
  highlights: string[];
  kitchen: string[];
  bathroom: string[];
  view: string[];
  facilities: string[];
};

export const EMPTY_AMENITIES: Amenities = {
  highlights: [],
  kitchen: [],
  bathroom: [],
  view: [],
  facilities: [],
};

/** Inventory code bounds (property / unit-type / unit). */
export const INVENTORY_CODE_MIN = 1;
export const INVENTORY_CODE_MAX = 32;
export const INVENTORY_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

export const INVENTORY_NAME_MIN = 1;
export const INVENTORY_NAME_MAX = 128;

export const INVENTORY_TIMEZONE_MAX = 64;
export const INVENTORY_ADDRESS_MAX = 255;
export const INVENTORY_CITY_MAX = 128;
export const INVENTORY_COUNTRY_CODE_LENGTH = 2;
export const INVENTORY_GOOGLE_PLACE_ID_MAX = 256;
export const INVENTORY_FLOOR_MAX = 16;
export const INVENTORY_HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const INVENTORY_LAT_MIN = -90;
export const INVENTORY_LAT_MAX = 90;
export const INVENTORY_LNG_MIN = -180;
export const INVENTORY_LNG_MAX = 180;

/**
 * Unit-type rack price caps (whole IDR, Prisma `Int` ≤ 2_147_483_647).
 * Daily 100M is plenty per night; monthly/yearly need headroom for IDR (seed yearly already >100M).
 */
export const UNIT_TYPE_DAILY_PRICE_IDR_MAX = 100_000_000;
export const UNIT_TYPE_MONTHLY_PRICE_IDR_MAX = 500_000_000;
export const UNIT_TYPE_YEARLY_PRICE_IDR_MAX = 2_000_000_000;

/** Lightweight property row for staff filter / select dropdowns (id + label only). */
export type StaffPropertyOption = {
  id: string;
  name: string;
};

/** Staff/PMS wire shape for a property (full ops row + counts). Not the public website catalog. */
export type StaffProperty = {
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
  typeCount: number;
  unitCount: number;
  createdAt: string;
  updatedAt: string;
};

/** Rack-rate read for stay Total suggestion — not the full ops row. */
export type StaffUnitTypeRack = {
  id: string;
  defaultPriceIdr: number;
  monthlyPriceIdr: number;
  yearlyPriceIdr: number;
};

export type StaffUnitType = {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  layout: UnitLayout;
  sizeSqm: number | null;
  bedroomCount: number;
  bathroomCount: number;
  maxGuests: number;
  defaultPriceIdr: number;
  monthlyPriceIdr: number;
  yearlyPriceIdr: number;
  bedConfig: BedConfigRoom[];
  amenities: Amenities;
  media: MediaItem[];
  description: string | null;
  smokingAllowed: boolean;
  sortOrder: number;
  isActive: boolean;
  unitCount: number;
  createdAt: string;
  updatedAt: string;
};

export type StaffUnit = {
  id: string;
  propertyId: string;
  unitTypeId: string;
  code: string;
  name: string | null;
  floor: string | null;
  status: UnitStatus;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Unit is bookable on status alone (catalog parents checked separately).
 * ACTIVE = bookable; MAINTENANCE / INACTIVE = not.
 */
export function isUnitStatusBookable(status: UnitStatus): boolean {
  return status === UnitStatus.ACTIVE;
}

/**
 * Why a unit row is not selectable in Choose unit for a stay range.
 * Priority when several apply: property → type → unit status → date overlap.
 */
export const UnitAvailabilityBlockReason = {
  PROPERTY_INACTIVE: 'PROPERTY_INACTIVE',
  UNIT_TYPE_INACTIVE: 'UNIT_TYPE_INACTIVE',
  UNIT_NOT_BOOKABLE: 'UNIT_NOT_BOOKABLE',
  DATE_OVERLAP: 'DATE_OVERLAP',
} as const;

export type UnitAvailabilityBlockReason =
  (typeof UnitAvailabilityBlockReason)[keyof typeof UnitAvailabilityBlockReason];

/** Choose unit wire: every matching unit + whether it can be selected. */
export type StaffUnitAvailability = StaffUnit & {
  available: boolean;
  blockReason: UnitAvailabilityBlockReason | null;
};

/** Occupying stay overlapping a calendar month (may start/end outside). */
export type UnitOccupancyBlock = {
  reservationId: string;
  checkInDate: string;
  checkOutDate: string;
};

/** Per-month busy intervals for date-picker blocking (unit POV). */
export type UnitMonthOccupancy = {
  unitId: string;
  /** YYYY-MM */
  yearMonth: string;
  blocks: UnitOccupancyBlock[];
};

/** Derive bedroomCount on write (locked product rule). */
export function deriveBedroomCount(
  layout: UnitLayout,
  bedConfig: BedConfigRoom[],
): number {
  if (layout === UnitLayout.STUDIO) {
    return 0;
  }
  return bedConfig.length;
}
