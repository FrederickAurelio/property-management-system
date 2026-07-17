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

/** First image in gallery order — used for unit-type cards. */
export function firstImageUrl(media: MediaItem[]): string | null {
  const image = media.find((item) => item.kind === "IMAGE");
  return image?.url ?? null;
}
