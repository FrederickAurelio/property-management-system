import { UnitLayout } from '../generated/prisma/index.js';
import {
  amenitiesApartment,
  buildUnitTypeData,
  type DemoUnitTypeTemplateKey,
  type SentralandUnitTypeCreateData,
  type UnitTypeFieldOverrides,
} from './sentraland-inventory-templates';

export const SENTRALAND_PROPERTY_CODE = 'SKYBREEZE_SENTRALAND';

export type SentralandUnitTypeManifest = {
  code: string;
  name: string;
  sortOrder: number;
  templateKey: DemoUnitTypeTemplateKey;
  overrides?: UnitTypeFieldOverrides;
};

export type SentralandUnitManifest = {
  unitTypeCode: string;
  prefix: 'BCN-' | 'STO-';
  room: number;
  notes?: string | null;
};

const ONE_BR_BED_CONFIG = [
  { room: 'Bedroom 1', beds: [{ type: 'DOUBLE', count: 1 }] },
];

export const SENTRALAND_UNIT_TYPES: SentralandUnitTypeManifest[] = [
  {
    code: 'STD_STUDIO_BCN',
    name: 'Studio Standard — Barcelona',
    sortOrder: 1,
    templateKey: 'DLX_STUDIO',
    overrides: { layout: UnitLayout.STUDIO, bedroomCount: 0 },
  },
  {
    code: 'DLX_STUDIO_BCN',
    name: 'Studio Deluxe — Barcelona',
    sortOrder: 2,
    templateKey: 'DLX_KING_STUDIO',
    overrides: { layout: UnitLayout.STUDIO, bedroomCount: 0 },
  },
  {
    code: 'DLX_STUDIO_STO',
    name: 'Studio Deluxe — Santorini',
    sortOrder: 3,
    templateKey: 'DLX_KING_STUDIO',
    overrides: { layout: UnitLayout.STUDIO, bedroomCount: 0 },
  },
  {
    code: 'STD_1BR_BCN',
    name: '1 Bedroom Standard — Barcelona',
    sortOrder: 4,
    templateKey: 'DLX_QUEEN_STUDIO',
    overrides: {
      layout: UnitLayout.APARTMENT,
      bedroomCount: 1,
      sizeSqm: 25,
      maxGuests: 2,
      amenities: amenitiesApartment,
      bedConfig: ONE_BR_BED_CONFIG,
    },
  },
  {
    code: 'STD_2BR_BCN',
    name: '2 Bedroom Standard — Barcelona',
    sortOrder: 5,
    templateKey: 'TWO_BR_STD',
  },
  {
    code: 'DLX_2BR_BCN',
    name: '2 Bedroom Deluxe — Barcelona',
    sortOrder: 6,
    templateKey: 'TWO_BR_STD',
    overrides: { deluxePricePremium: true },
  },
  {
    code: 'STD_3BR_BCN',
    name: '3 Bedroom Standard — Barcelona',
    sortOrder: 7,
    templateKey: 'THREE_BR_STD',
  },
  {
    code: 'DLX_3BR_BCN',
    name: '3 Bedroom Deluxe — Barcelona',
    sortOrder: 8,
    templateKey: 'THREE_BR_STD',
    overrides: { deluxePricePremium: true },
  },
  {
    code: 'UNF_2BR',
    name: '2 Bedroom Unfurnished',
    sortOrder: 9,
    templateKey: 'TWO_BR_STD',
  },
];

export const SENTRALAND_UNITS: SentralandUnitManifest[] = [
  // Studio Standard — Barcelona
  ...rooms(
    'STD_STUDIO_BCN',
    'BCN-',
    [701, 928, 930, 1001, 1030, 1101, 1227, 1229, 1501, 2101],
  ),
  // Studio Deluxe — Barcelona
  ...rooms('DLX_STUDIO_BCN', 'BCN-', [2001]),
  // Studio Deluxe — Santorini
  ...rooms('DLX_STUDIO_STO', 'STO-', [973, 1073, 1173]),
  // 1 Bedroom Standard — Barcelona
  ...rooms(
    'STD_1BR_BCN',
    'BCN-',
    [
      825, 926, 1025, 1026, 1125, 1126, 1225, 1226, 1525, 1526, 1625, 1626,
      1725,
    ],
  ),
  // 2 Bedroom Standard — Barcelona
  ...rooms(
    'STD_2BR_BCN',
    'BCN-',
    [
      507, 832, 833, 932, 933, 1021, 1032, 1033, 1132, 1133, 1232, 1521, 1532,
      1632,
    ],
  ),
  // 2 Bedroom Deluxe — Barcelona
  ...rooms('DLX_2BR_BCN', 'BCN-', [1522, 2132]),
  // 3 Bedroom Standard — Barcelona
  ...rooms('STD_3BR_BCN', 'BCN-', [501, 502, 522, 602, 636]),
  // 3 Bedroom Deluxe — Barcelona
  ...rooms('DLX_3BR_BCN', 'BCN-', [1236]),
  // 2 Bedroom Unfurnished
  ...rooms(
    'UNF_2BR',
    'BCN-',
    [817, 917, 1017, 1117, 1217, 1517, 1617, 1717, 1811, 2026, 2133],
  ),
];

function rooms(
  unitTypeCode: string,
  prefix: 'BCN-' | 'STO-',
  roomNumbers: number[],
): SentralandUnitManifest[] {
  return roomNumbers.map((room) => ({
    unitTypeCode,
    prefix,
    room,
    notes: room === 1532 ? 'Perumnas' : null,
  }));
}

export function roomToFloor(room: number): string {
  return String(Math.floor(room / 100));
}

export function unitCode(prefix: 'BCN-' | 'STO-', room: number): string {
  return `${prefix}${room}`;
}

export function buildSentralandUnitTypeRows(): SentralandUnitTypeCreateData[] {
  return SENTRALAND_UNIT_TYPES.map((manifest) =>
    buildUnitTypeData(
      manifest.templateKey,
      {
        code: manifest.code,
        name: manifest.name,
        sortOrder: manifest.sortOrder,
      },
      manifest.overrides,
    ),
  );
}

export const SENTRALAND_UNIT_TYPE_COUNT = SENTRALAND_UNIT_TYPES.length;
export const SENTRALAND_UNIT_COUNT = SENTRALAND_UNITS.length;
