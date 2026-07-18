// MOCK — domain entity shapes; align with @cabin/api-contract when API is wired.
import type { MediaItem } from "@/components/media/types";

export type {
  MediaKind,
  MediaItem,
} from "@/components/media/types";
export {
  isImageMime,
  isVideoMime,
  mediaKindFromMime,
} from "@/components/media/types";
export type { ExplorerView } from "@/components/explorer/types";

export type UnitStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";
export type UnitLayout = "STUDIO" | "APARTMENT" | "CABIN" | "OTHER";

export type BedKind =
  | "SINGLE"
  | "DOUBLE"
  | "LARGE_DOUBLE"
  | "QUEEN"
  | "KING"
  | "SOFA_BED"
  | "OTHER";

export type BedConfigRoom = {
  room: string;
  beds: { type: BedKind; count: number }[];
};

export type Amenities = {
  highlights: string[];
  kitchen: string[];
  bathroom: string[];
  view: string[];
  facilities: string[];
};

export type Property = {
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
  /** WGS84 — used to plot all properties on our own map (web). */
  latitude: number | null;
  longitude: number | null;
  /**
   * Google Place ID (e.g. ChIJ…) — durable id for “Open in Google Maps”.
   * Prefer this over share/short links.
   */
  googlePlaceId: string | null;
  /** Single cover image for explorer cards */
  coverImage: MediaItem | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UnitType = {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  layout: UnitLayout;
  sizeSqm: number | null;
  bedroomCount: number;
  bathroomCount: number;
  maxGuests: number;
  /** Default rack rate per night in IDR (whole rupiah, no decimals). */
  defaultPriceIdr: number;
  bedConfig: BedConfigRoom[];
  amenities: Amenities;
  /** Ordered gallery — first IMAGE is the card thumbnail */
  media: MediaItem[];
  description: string | null;
  smokingAllowed: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Unit = {
  id: string;
  propertyId: string;
  unitTypeId: string;
  code: string;
  name: string | null;
  floor: string | null;
  status: UnitStatus;
  notes: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryState = {
  properties: Property[];
  unitTypes: UnitType[];
  units: Unit[];
};

export const EMPTY_AMENITIES: Amenities = {
  highlights: [],
  kitchen: [],
  bathroom: [],
  view: [],
  facilities: [],
};

export function formatUnitStatus(status: UnitStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
      return "Inactive";
    case "MAINTENANCE":
      return "Maintenance";
  }
}

export function formatLayout(layout: UnitLayout): string {
  switch (layout) {
    case "STUDIO":
      return "Studio";
    case "APARTMENT":
      return "Apartment";
    case "CABIN":
      return "Cabin";
    case "OTHER":
      return "Other";
  }
}

/** Format whole-rupiah amounts for display (e.g. Rp450.000). */
export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Thousand-separated digits for an IDR input (e.g. "450000" → "450.000"). */
export function formatIdrInput(digits: string): string {
  if (!digits) {
    return "";
  }
  const n = Number(digits);
  if (!Number.isFinite(n)) {
    return "";
  }
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(n);
}

/** Keep only digits from a currency-masked IDR input (no leading zeros). */
export function digitsFromIdrInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  return String(Number(digits));
}

export function hasCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude)
  );
}

/**
 * Prefer Google Place ID (named place card).
 * Fall back to coordinates, then address text search.
 */
export function googleMapsUrl(input: {
  googlePlaceId?: string | null;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  addressLine?: string | null;
  city?: string | null;
  countryCode?: string | null;
}): string | null {
  const placeId = input.googlePlaceId?.trim();
  if (placeId) {
    const params = new URLSearchParams({
      api: "1",
      query_place_id: placeId,
    });
    // `query` helps Maps show a label; Place ID is what selects the place.
    const label = input.name?.trim() || input.addressLine?.trim();
    if (label) {
      params.set("query", label);
    }
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }

  if (hasCoordinates(input.latitude, input.longitude)) {
    return `https://www.google.com/maps?q=${input.latitude},${input.longitude}`;
  }

  const query = [
    input.name,
    input.addressLine,
    input.city,
    input.countryCode,
  ]
    .map((part) => part?.trim())
    .filter((part, index, all) => Boolean(part) && all.indexOf(part) === index)
    .join(", ");
  if (!query) {
    return null;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** First image in gallery order — used for unit-type cards. */
export function firstImageUrl(media: MediaItem[]): string | null {
  const image = media.find((item) => item.kind === "IMAGE");
  return image?.url ?? null;
}
