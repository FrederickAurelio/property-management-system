/* anchor: Stripe-data catalog, diverge: Booking-style amenity codes from _docs */
import i18n from "@/i18n";
import type { Amenities, BedKind } from "./inventory-types";

export type AmenityGroupKey = keyof Amenities;

export type AmenityOption = {
  code: string;
  label: string;
};

const AMENITY_GROUP_CODES: {
  key: AmenityGroupKey;
  labelKey: string;
  codes: string[];
}[] = [
  {
    key: "highlights",
    labelKey: "amenities.groups.highlights",
    codes: [
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
  },
  {
    key: "kitchen",
    labelKey: "amenities.groups.kitchen",
    codes: ["REFRIGERATOR", "KITCHENWARE", "ELECTRIC_KETTLE", "STOVETOP"],
  },
  {
    key: "bathroom",
    labelKey: "amenities.groups.bathroom",
    codes: ["SHOWER", "BIDET"],
  },
  {
    key: "view",
    labelKey: "amenities.groups.view",
    codes: ["BALCONY", "TERRACE", "CITY_VIEW"],
  },
  {
    key: "facilities",
    labelKey: "amenities.groups.facilities",
    codes: [
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
      "HARDWOOD_PARQUET",
      "DESK",
      "DINING_AREA",
      "DINING_TABLE",
      "SOFA",
    ],
  },
];

/** Re-reads `i18n.t` on every call so labels follow the current language. */
export function getAmenityGroups(): {
  key: AmenityGroupKey;
  label: string;
  options: AmenityOption[];
}[] {
  return AMENITY_GROUP_CODES.map((group) => ({
    key: group.key,
    label: i18n.t(`inventory:${group.labelKey}`),
    options: group.codes.map((code) => ({
      code,
      label: i18n.t(`inventory:amenities.options.${code}`),
    })),
  }));
}

const BED_KIND_CODES: BedKind[] = [
  "SINGLE",
  "DOUBLE",
  "LARGE_DOUBLE",
  "QUEEN",
  "KING",
  "SOFA_BED",
  "OTHER",
];

/** Re-reads `i18n.t` on every call so labels follow the current language. */
export function getBedKindOptions(): { value: BedKind; label: string }[] {
  return BED_KIND_CODES.map((value) => ({
    value,
    label: i18n.t(`inventory:bedKinds.${value}`),
  }));
}

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
  const bedKindOptions = getBedKindOptions();
  const parts = bedConfig.flatMap((room) =>
    room.beds.map((bed) => {
      const label =
        bedKindOptions.find((o) => o.value === bed.type)?.label ?? bed.type;
      return bed.count > 1 ? `${bed.count}× ${label}` : label;
    }),
  );
  return parts.join(", ");
}
