/** Inventory display helpers — wire types come from `@cabin/api-contract`. */
export type {
  Amenities,
  BedConfigRoom,
  BedKind,
  MediaItem,
  MediaKind,
  StaffProperty,
  StaffUnit,
  StaffUnitType,
  UnitLayout,
  UnitStatus,
} from "@cabin/api-contract";
export {
  EMPTY_AMENITIES,
  MediaKind as MediaKindValue,
  UnitLayout as UnitLayoutValue,
  UnitStatus as UnitStatusValue,
} from "@cabin/api-contract";
export type { ExplorerView } from "@/components/explorer/types";
export {
  isImageMime,
  isVideoMime,
  mediaKindFromMime,
} from "@/components/media/types";

import type {
  MediaItem,
  UnitLayout,
  UnitStatus,
} from "@cabin/api-contract";

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
