import type {
  Amenities,
  BedConfigRoom,
  MediaItem,
  StaffProperty,
  StaffUnit,
  StaffUnitType,
} from '@cabin/api-contract';
import { EMPTY_AMENITIES } from '@cabin/api-contract';
import type { Property, Unit, UnitType } from '../../generated/prisma/index.js';

function decimalToNumber(value: { toNumber(): number } | null): number | null {
  if (value === null) {
    return null;
  }
  return value.toNumber();
}

function asMediaItem(value: unknown): MediaItem | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.kind !== 'string' ||
    typeof record.url !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.mimeType !== 'string'
  ) {
    return null;
  }
  return {
    id: record.id,
    kind: record.kind as MediaItem['kind'],
    url: record.url,
    name: record.name,
    mimeType: record.mimeType,
  };
}

function asMediaList(value: unknown): MediaItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asMediaItem(item))
    .filter((item): item is MediaItem => item !== null);
}

function asBedConfig(value: unknown): BedConfigRoom[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as BedConfigRoom[];
}

function asAmenities(value: unknown): Amenities {
  if (typeof value !== 'object' || value === null) {
    return { ...EMPTY_AMENITIES };
  }
  const record = value as Record<string, unknown>;
  return {
    highlights: Array.isArray(record.highlights)
      ? (record.highlights as string[])
      : [],
    kitchen: Array.isArray(record.kitchen) ? (record.kitchen as string[]) : [],
    bathroom: Array.isArray(record.bathroom)
      ? (record.bathroom as string[])
      : [],
    view: Array.isArray(record.view) ? (record.view as string[]) : [],
    facilities: Array.isArray(record.facilities)
      ? (record.facilities as string[])
      : [],
  };
}

export function toStaffProperty(
  row: Property,
  counts: { typeCount: number; unitCount: number },
): StaffProperty {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    timezone: row.timezone,
    checkInFrom: row.checkInFrom,
    checkInUntil: row.checkInUntil,
    checkOutFrom: row.checkOutFrom,
    checkOutUntil: row.checkOutUntil,
    addressLine: row.addressLine,
    city: row.city,
    countryCode: row.countryCode,
    latitude: decimalToNumber(row.latitude),
    longitude: decimalToNumber(row.longitude),
    googlePlaceId: row.googlePlaceId,
    coverImage: asMediaItem(row.coverImage),
    isActive: row.isActive,
    typeCount: counts.typeCount,
    unitCount: counts.unitCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toStaffUnitType(
  row: UnitType,
  unitCount: number,
): StaffUnitType {
  return {
    id: row.id,
    propertyId: row.propertyId,
    code: row.code,
    name: row.name,
    layout: row.layout,
    sizeSqm: decimalToNumber(row.sizeSqm),
    bedroomCount: row.bedroomCount,
    bathroomCount: row.bathroomCount,
    maxGuests: row.maxGuests,
    defaultPriceIdr: row.defaultPriceIdr,
    bedConfig: asBedConfig(row.bedConfig),
    amenities: asAmenities(row.amenities),
    media: asMediaList(row.media),
    description: row.description,
    smokingAllowed: row.smokingAllowed,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    unitCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toStaffUnit(row: Unit): StaffUnit {
  return {
    id: row.id,
    propertyId: row.propertyId,
    unitTypeId: row.unitTypeId,
    code: row.code,
    name: row.name,
    floor: row.floor,
    status: row.status,
    notes: row.notes,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
