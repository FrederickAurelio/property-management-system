/* anchor: Stripe-data catalog, diverge: Booking-style amenity codes from _docs */
import type { Amenities, BedKind } from "./inventory-types";

export type AmenityGroupKey = keyof Amenities;

export type AmenityOption = {
  code: string;
  label: string;
};

export const AMENITY_GROUPS: {
  key: AmenityGroupKey;
  label: string;
  options: AmenityOption[];
}[] = [
  {
    key: "highlights",
    label: "Highlights",
    options: [
      { code: "PRIVATE_KITCHEN", label: "Private kitchen" },
      { code: "PRIVATE_BATHROOM", label: "Private bathroom" },
      { code: "BALCONY", label: "Balcony" },
      { code: "CITY_VIEW", label: "City view" },
      { code: "POOL_WITH_A_VIEW", label: "Pool with a view" },
      { code: "AIR_CONDITIONING", label: "Air conditioning" },
      { code: "FLAT_SCREEN_TV", label: "Flat-screen TV" },
      { code: "SOUNDPROOFING", label: "Soundproofing" },
      { code: "TERRACE", label: "Terrace" },
      { code: "FREE_WIFI", label: "Free WiFi" },
    ],
  },
  {
    key: "kitchen",
    label: "Kitchen",
    options: [
      { code: "REFRIGERATOR", label: "Refrigerator" },
      { code: "KITCHENWARE", label: "Kitchenware" },
      { code: "ELECTRIC_KETTLE", label: "Electric kettle" },
      { code: "STOVETOP", label: "Stovetop" },
    ],
  },
  {
    key: "bathroom",
    label: "Bathroom",
    options: [
      { code: "SHOWER", label: "Shower" },
      { code: "BIDET", label: "Bidet" },
    ],
  },
  {
    key: "view",
    label: "View",
    options: [
      { code: "BALCONY", label: "Balcony" },
      { code: "TERRACE", label: "Terrace" },
      { code: "CITY_VIEW", label: "City view" },
    ],
  },
  {
    key: "facilities",
    label: "Facilities",
    options: [
      { code: "ELEVATOR_ACCESS", label: "Elevator access" },
      { code: "FLAT_SCREEN_TV", label: "Flat-screen TV" },
      { code: "TOWELS", label: "Towels" },
      { code: "WHEELCHAIR_ACCESSIBLE", label: "Wheelchair accessible" },
      { code: "SEATING_AREA", label: "Seating area" },
      { code: "SOCKET_NEAR_BED", label: "Socket near the bed" },
      { code: "LINEN", label: "Linen" },
      { code: "TILE_MARBLE_FLOOR", label: "Tile / marble floor" },
      { code: "WARDROBE", label: "Wardrobe or closet" },
      { code: "CLEANING_PRODUCTS", label: "Cleaning products" },
      { code: "SOUNDPROOFING", label: "Soundproofing" },
      { code: "AIR_CONDITIONING", label: "Air conditioning" },
      { code: "HARDWOOD_PARQUET", label: "Hardwood or parquet" },
      { code: "DESK", label: "Desk" },
      { code: "DINING_AREA", label: "Dining area" },
      { code: "DINING_TABLE", label: "Dining table" },
      { code: "SOFA", label: "Sofa" },
    ],
  },
];

export const BED_KIND_OPTIONS: { value: BedKind; label: string }[] = [
  { value: "SINGLE", label: "Single" },
  { value: "DOUBLE", label: "Double" },
  { value: "LARGE_DOUBLE", label: "Large double" },
  { value: "QUEEN", label: "Queen" },
  { value: "KING", label: "King" },
  { value: "SOFA_BED", label: "Sofa bed" },
  { value: "OTHER", label: "Other" },
];

export function countAmenities(amenities: Amenities): number {
  return (
    amenities.highlights.length +
    amenities.kitchen.length +
    amenities.bathroom.length +
    amenities.view.length +
    amenities.facilities.length
  );
}

export function formatBedSummary(
  bedConfig: { room: string; beds: { type: BedKind; count: number }[] }[],
): string | null {
  if (bedConfig.length === 0) {
    return null;
  }
  const parts = bedConfig.flatMap((room) =>
    room.beds.map((bed) => {
      const label =
        BED_KIND_OPTIONS.find((o) => o.value === bed.type)?.label ?? bed.type;
      return bed.count > 1 ? `${bed.count}× ${label}` : label;
    }),
  );
  return parts.join(", ");
}
