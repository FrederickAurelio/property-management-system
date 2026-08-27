import { Prisma, UnitLayout } from '../generated/prisma/index.js';

export const amenitiesStudio = {
  highlights: [
    'PRIVATE_KITCHEN',
    'PRIVATE_BATHROOM',
    'BALCONY',
    'CITY_VIEW',
    'POOL_WITH_A_VIEW',
    'AIR_CONDITIONING',
    'FLAT_SCREEN_TV',
    'SOUNDPROOFING',
    'TERRACE',
    'FREE_WIFI',
  ],
  kitchen: ['REFRIGERATOR', 'KITCHENWARE', 'ELECTRIC_KETTLE', 'STOVETOP'],
  bathroom: ['SHOWER', 'BIDET'],
  view: ['BALCONY', 'TERRACE', 'CITY_VIEW'],
  facilities: [
    'ELEVATOR_ACCESS',
    'FLAT_SCREEN_TV',
    'TOWELS',
    'WHEELCHAIR_ACCESSIBLE',
    'SEATING_AREA',
    'SOCKET_NEAR_BED',
    'LINEN',
    'TILE_MARBLE_FLOOR',
    'WARDROBE',
    'CLEANING_PRODUCTS',
    'SOUNDPROOFING',
    'AIR_CONDITIONING',
  ],
};

export const amenitiesApartment = {
  ...amenitiesStudio,
  highlights: amenitiesStudio.highlights.filter(
    (h) => h !== 'POOL_WITH_A_VIEW',
  ),
};

/** Placeholder utility rates — not live client tariffs. */
export const SEED_UTILITY_RATES = {
  electricityRateIdrPerKwh: 1_700,
  waterRateIdrPerM3: 12_000,
  maintenanceFeeIdrPerMonth: 100_000,
} as const;

const DELUXE_PRICE_MULTIPLIER = 1.15;

type MediaItemSeed = {
  id: string;
  kind: string;
  url: string;
  name: string;
  mimeType: string;
};

type DemoTemplateSeed = {
  layout: UnitLayout;
  sizeSqm: number;
  bedroomCount: number;
  bathroomCount: number;
  maxGuests: number;
  defaultPriceIdr: number;
  monthlyPriceIdr: number;
  yearlyPriceIdr: number;
  bedConfig: Prisma.InputJsonValue;
  amenities: Prisma.InputJsonValue;
  media: MediaItemSeed[];
  description?: string;
};

export type DemoUnitTypeTemplateKey =
  | 'TWO_BR_STD'
  | 'THREE_BR_STD'
  | 'DLX_KING_STUDIO'
  | 'DLX_QUEEN_STUDIO'
  | 'DLX_STUDIO';

export const DEMO_UNIT_TYPE_TEMPLATES: Record<
  DemoUnitTypeTemplateKey,
  DemoTemplateSeed
> = {
  TWO_BR_STD: {
    layout: UnitLayout.APARTMENT,
    sizeSqm: 36,
    bedroomCount: 2,
    bathroomCount: 1,
    maxGuests: 3,
    defaultPriceIdr: 650_000,
    monthlyPriceIdr: 16_900_000,
    yearlyPriceIdr: 195_000_000,
    bedConfig: [
      { room: 'Bedroom 1', beds: [{ type: 'DOUBLE', count: 1 }] },
      { room: 'Bedroom 2', beds: [{ type: 'SINGLE', count: 1 }] },
    ],
    amenities: amenitiesApartment,
    media: [
      {
        id: 'm_two_1',
        kind: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
        name: 'Living room',
        mimeType: 'image/jpeg',
      },
      {
        id: 'm_two_2',
        kind: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
        name: 'Bedroom',
        mimeType: 'image/jpeg',
      },
    ],
  },
  THREE_BR_STD: {
    layout: UnitLayout.APARTMENT,
    sizeSqm: 54,
    bedroomCount: 3,
    bathroomCount: 1,
    maxGuests: 3,
    defaultPriceIdr: 850_000,
    monthlyPriceIdr: 22_100_000,
    yearlyPriceIdr: 255_000_000,
    bedConfig: [
      { room: 'Bedroom 1', beds: [{ type: 'DOUBLE', count: 1 }] },
      { room: 'Bedroom 2', beds: [{ type: 'SINGLE', count: 1 }] },
      { room: 'Bedroom 3', beds: [{ type: 'SINGLE', count: 1 }] },
    ],
    amenities: amenitiesApartment,
    media: [
      {
        id: 'm_three_1',
        kind: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
        name: 'Apartment',
        mimeType: 'image/jpeg',
      },
    ],
  },
  DLX_KING_STUDIO: {
    layout: UnitLayout.STUDIO,
    sizeSqm: 21,
    bedroomCount: 0,
    bathroomCount: 1,
    maxGuests: 2,
    defaultPriceIdr: 550_000,
    monthlyPriceIdr: 14_300_000,
    yearlyPriceIdr: 165_000_000,
    bedConfig: [{ room: 'Studio', beds: [{ type: 'LARGE_DOUBLE', count: 1 }] }],
    amenities: amenitiesStudio,
    media: [
      {
        id: 'm_king_1',
        kind: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',
        name: 'King studio',
        mimeType: 'image/jpeg',
      },
    ],
  },
  DLX_QUEEN_STUDIO: {
    layout: UnitLayout.STUDIO,
    sizeSqm: 18,
    bedroomCount: 0,
    bathroomCount: 1,
    maxGuests: 2,
    defaultPriceIdr: 450_000,
    monthlyPriceIdr: 11_700_000,
    yearlyPriceIdr: 135_000_000,
    bedConfig: [{ room: 'Studio', beds: [{ type: 'LARGE_DOUBLE', count: 1 }] }],
    amenities: amenitiesStudio,
    media: [
      {
        id: 'm_queen_1',
        kind: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',
        name: 'Queen studio',
        mimeType: 'image/jpeg',
      },
    ],
  },
  DLX_STUDIO: {
    layout: UnitLayout.STUDIO,
    sizeSqm: 18,
    bedroomCount: 0,
    bathroomCount: 1,
    maxGuests: 2,
    defaultPriceIdr: 400_000,
    monthlyPriceIdr: 10_400_000,
    yearlyPriceIdr: 120_000_000,
    bedConfig: [{ room: 'Studio', beds: [{ type: 'LARGE_DOUBLE', count: 1 }] }],
    amenities: amenitiesStudio,
    media: [
      {
        id: 'm_studio_1',
        kind: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
        name: 'Studio',
        mimeType: 'image/jpeg',
      },
      {
        id: 'm_studio_2',
        kind: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&q=80',
        name: 'Kitchen',
        mimeType: 'image/jpeg',
      },
    ],
    description:
      'The pool with a view is a top feature of this studio. Entire studio 18 m².',
  },
};

export type UnitTypeFieldOverrides = Partial<
  Pick<
    DemoTemplateSeed,
    | 'layout'
    | 'sizeSqm'
    | 'bedroomCount'
    | 'bathroomCount'
    | 'maxGuests'
    | 'defaultPriceIdr'
    | 'monthlyPriceIdr'
    | 'yearlyPriceIdr'
    | 'bedConfig'
    | 'amenities'
    | 'description'
  >
> & {
  deluxePricePremium?: boolean;
};

function cloneMediaWithPrefix(
  media: MediaItemSeed[],
  idPrefix: string,
): MediaItemSeed[] {
  return media.map((item, index) => ({
    ...item,
    id: `m_${idPrefix}_${index + 1}`,
  }));
}

function applyDeluxePremium(prices: {
  defaultPriceIdr: number;
  monthlyPriceIdr: number;
  yearlyPriceIdr: number;
}): {
  defaultPriceIdr: number;
  monthlyPriceIdr: number;
  yearlyPriceIdr: number;
} {
  return {
    defaultPriceIdr: Math.round(
      prices.defaultPriceIdr * DELUXE_PRICE_MULTIPLIER,
    ),
    monthlyPriceIdr: Math.round(
      prices.monthlyPriceIdr * DELUXE_PRICE_MULTIPLIER,
    ),
    yearlyPriceIdr: Math.round(prices.yearlyPriceIdr * DELUXE_PRICE_MULTIPLIER),
  };
}

export type SentralandUnitTypeCreateData = {
  code: string;
  name: string;
  sortOrder: number;
  layout: UnitLayout;
  sizeSqm: number;
  bedroomCount: number;
  bathroomCount: number;
  maxGuests: number;
  defaultPriceIdr: number;
  monthlyPriceIdr: number;
  yearlyPriceIdr: number;
  electricityRateIdrPerKwh: number;
  waterRateIdrPerM3: number;
  maintenanceFeeIdrPerMonth: number;
  bedConfig: Prisma.InputJsonValue;
  amenities: Prisma.InputJsonValue;
  media: Prisma.InputJsonValue;
  description: string | null;
  smokingAllowed: boolean;
  isActive: boolean;
};

export function buildUnitTypeData(
  templateKey: DemoUnitTypeTemplateKey,
  identity: { code: string; name: string; sortOrder: number },
  overrides: UnitTypeFieldOverrides = {},
): SentralandUnitTypeCreateData {
  const template = DEMO_UNIT_TYPE_TEMPLATES[templateKey];
  const { deluxePricePremium, ...fieldOverrides } = overrides;

  const basePrices = {
    defaultPriceIdr: fieldOverrides.defaultPriceIdr ?? template.defaultPriceIdr,
    monthlyPriceIdr: fieldOverrides.monthlyPriceIdr ?? template.monthlyPriceIdr,
    yearlyPriceIdr: fieldOverrides.yearlyPriceIdr ?? template.yearlyPriceIdr,
  };
  const prices = deluxePricePremium
    ? applyDeluxePremium(basePrices)
    : basePrices;

  const mediaPrefix = identity.code.toLowerCase();

  return {
    code: identity.code,
    name: identity.name,
    sortOrder: identity.sortOrder,
    layout: fieldOverrides.layout ?? template.layout,
    sizeSqm: fieldOverrides.sizeSqm ?? template.sizeSqm,
    bedroomCount: fieldOverrides.bedroomCount ?? template.bedroomCount,
    bathroomCount: fieldOverrides.bathroomCount ?? template.bathroomCount,
    maxGuests: fieldOverrides.maxGuests ?? template.maxGuests,
    ...prices,
    ...SEED_UTILITY_RATES,
    bedConfig: fieldOverrides.bedConfig ?? template.bedConfig,
    amenities: fieldOverrides.amenities ?? template.amenities,
    media: cloneMediaWithPrefix(template.media, mediaPrefix),
    description: fieldOverrides.description ?? template.description ?? null,
    smokingAllowed: false,
    isActive: true,
  };
}
