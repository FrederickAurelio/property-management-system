import { randomBytes } from 'node:crypto';
import { PrismaClient, UnitStatus } from '../generated/prisma/index.js';
import {
  SENTRALAND_PROPERTY_CODE,
  SENTRALAND_UNIT_COUNT,
  SENTRALAND_UNIT_TYPE_COUNT,
  SENTRALAND_UNITS,
  buildSentralandUnitTypeRows,
  roomToFloor,
  unitCode,
} from './sentraland-inventory';
import {
  SEED_ADMIN_FEE_IDR_PER_MONTH,
  SEED_ELECTRICITY_MIN_KWH,
  SEED_UTILITY_ADDONS,
} from './sentraland-inventory-templates';

export function newIcalExportToken(): string {
  return randomBytes(24).toString('hex');
}

export const SKYBREEZE_PROPERTY_CREATE_DATA = {
  code: SENTRALAND_PROPERTY_CODE,
  name: 'Skybreeze Sentraland',
  timezone: 'Asia/Jakarta',
  checkInFrom: '15:00',
  checkInUntil: '23:30',
  checkOutFrom: '08:00',
  checkOutUntil: '12:00',
  addressLine:
    'Jl. Nikel, Sukaramai II, Kec. Medan Area, Kota Medan, Sumatera Utara 20224',
  city: 'Medan',
  countryCode: 'ID',
  latitude: 3.5858139,
  longitude: 98.7040167,
  googlePlaceId: 'ChIJDQnc_KkxMTAR4tzfa3cP0Yw',
  coverImage: {
    id: 'cover_skybreeze',
    kind: 'IMAGE',
    url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
    name: 'Skybreeze cover',
    mimeType: 'image/jpeg',
  },
  isActive: true,
} as const;

type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export type WipeSentralandInventoryResult = {
  reservationCount: number;
  calendarBlockCount: number;
  icalFeedCount: number;
  unitCount: number;
  unitTypeCount: number;
};

export async function wipeSentralandInventory(
  tx: PrismaTx,
  propertyId: string,
): Promise<WipeSentralandInventoryResult> {
  const units = await tx.unit.findMany({
    where: { propertyId },
    select: { id: true },
  });
  const unitIds = units.map((unit) => unit.id);

  if (unitIds.length === 0) {
    const unitTypeCount = await tx.unitType.deleteMany({
      where: { propertyId },
    });
    return {
      reservationCount: 0,
      calendarBlockCount: 0,
      icalFeedCount: 0,
      unitCount: 0,
      unitTypeCount: unitTypeCount.count,
    };
  }

  const reservationCount = await tx.reservation.count({
    where: { unitId: { in: unitIds } },
  });

  await tx.reservation.deleteMany({
    where: { unitId: { in: unitIds } },
  });

  await tx.reservation.updateMany({
    where: { icalObservedUnitId: { in: unitIds } },
    data: { icalObservedUnitId: null },
  });

  const calendarBlockResult = await tx.calendarBlock.deleteMany({
    where: { unitId: { in: unitIds } },
  });

  const icalFeedResult = await tx.unitIcalFeed.deleteMany({
    where: { unitId: { in: unitIds } },
  });

  const unitResult = await tx.unit.deleteMany({
    where: { propertyId },
  });

  const unitTypeResult = await tx.unitType.deleteMany({
    where: { propertyId },
  });

  return {
    reservationCount,
    calendarBlockCount: calendarBlockResult.count,
    icalFeedCount: icalFeedResult.count,
    unitCount: unitResult.count,
    unitTypeCount: unitTypeResult.count,
  };
}

export async function createSentralandInventory(
  tx: PrismaTx,
  propertyId: string,
): Promise<{ unitTypeCount: number; unitCount: number }> {
  const unitTypeRows = buildSentralandUnitTypeRows();
  const unitTypeIdByCode = new Map<string, string>();

  for (const row of unitTypeRows) {
    const created = await tx.unitType.create({
      data: {
        propertyId,
        ...row,
        bedConfig: row.bedConfig,
        amenities: row.amenities,
        media: row.media,
        utilityAddons: {
          create: SEED_UTILITY_ADDONS.map((addon) => ({
            utility: addon.utility,
            name: addon.name,
            kind: addon.kind,
            value: addon.value,
            sortOrder: addon.sortOrder,
          })),
        },
      },
    });
    unitTypeIdByCode.set(created.code, created.id);
  }

  const unitsByType = new Map<string, number>();

  for (const unitManifest of SENTRALAND_UNITS) {
    const unitTypeId = unitTypeIdByCode.get(unitManifest.unitTypeCode);
    if (!unitTypeId) {
      throw new Error(
        `Missing unit type for unit manifest: ${unitManifest.unitTypeCode}`,
      );
    }

    const sortOrder = (unitsByType.get(unitManifest.unitTypeCode) ?? 0) + 1;
    unitsByType.set(unitManifest.unitTypeCode, sortOrder);

    await tx.unit.create({
      data: {
        propertyId,
        unitTypeId,
        code: unitCode(unitManifest.prefix, unitManifest.room),
        floor: roomToFloor(unitManifest.room),
        status: UnitStatus.ACTIVE,
        sortOrder,
        notes: unitManifest.notes ?? null,
        icalExportToken: newIcalExportToken(),
      },
    });
  }

  return {
    unitTypeCount: unitTypeRows.length,
    unitCount: SENTRALAND_UNITS.length,
  };
}

export async function applySentralandInventoryReplace(
  prisma: PrismaClient,
): Promise<{
  propertyId: string;
  wiped: WipeSentralandInventoryResult;
  created: { unitTypeCount: number; unitCount: number };
}> {
  const property = await prisma.property.findUnique({
    where: { code: SENTRALAND_PROPERTY_CODE },
    select: { id: true },
  });

  if (!property) {
    throw new Error(
      `Property ${SENTRALAND_PROPERTY_CODE} not found. Run seed or create the property in PMS first.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const wiped = await wipeSentralandInventory(tx, property.id);
    const created = await createSentralandInventory(tx, property.id);
    return { propertyId: property.id, wiped, created };
  });
}

export type EnsureSkybreezeUtilityDefaultsResult = {
  unitTypeCount: number;
  addonSchemesCreated: number;
  minKwhFilled: number;
  adminFeeFilled: number;
};

/**
 * Fill-if-empty Skybreeze utility scheme. Never writes live
 * electricityRateIdrPerKwh / waterRateIdrPerM3 / maintenanceFeeIdrPerMonth.
 * Add-ons are created only when a unit type has zero rows; min kWh and admin
 * fee only when still 0.
 */
export async function ensureSkybreezeUtilityDefaults(
  prisma: PrismaClient,
): Promise<EnsureSkybreezeUtilityDefaultsResult> {
  const property = await prisma.property.findUnique({
    where: { code: SENTRALAND_PROPERTY_CODE },
    select: { id: true },
  });
  if (!property) {
    return {
      unitTypeCount: 0,
      addonSchemesCreated: 0,
      minKwhFilled: 0,
      adminFeeFilled: 0,
    };
  }

  const types = await prisma.unitType.findMany({
    where: { propertyId: property.id },
    select: {
      id: true,
      electricityMinKwh: true,
      adminFeeIdrPerMonth: true,
      _count: { select: { utilityAddons: true } },
    },
  });

  let addonSchemesCreated = 0;
  let minKwhFilled = 0;
  let adminFeeFilled = 0;

  for (const row of types) {
    const minKwh = Number(row.electricityMinKwh);
    const shouldFillMinKwh = minKwh === 0;
    const shouldFillAdminFee = row.adminFeeIdrPerMonth === 0;
    if (shouldFillMinKwh || shouldFillAdminFee) {
      await prisma.unitType.update({
        where: { id: row.id },
        data: {
          ...(shouldFillMinKwh
            ? { electricityMinKwh: SEED_ELECTRICITY_MIN_KWH }
            : {}),
          ...(shouldFillAdminFee
            ? { adminFeeIdrPerMonth: SEED_ADMIN_FEE_IDR_PER_MONTH }
            : {}),
        },
      });
      if (shouldFillMinKwh) {
        minKwhFilled += 1;
      }
      if (shouldFillAdminFee) {
        adminFeeFilled += 1;
      }
    }

    if (row._count.utilityAddons === 0) {
      await prisma.unitTypeUtilityAddon.createMany({
        data: SEED_UTILITY_ADDONS.map((addon) => ({
          unitTypeId: row.id,
          utility: addon.utility,
          name: addon.name,
          kind: addon.kind,
          value: addon.value,
          sortOrder: addon.sortOrder,
        })),
      });
      addonSchemesCreated += 1;
    }
  }

  return {
    unitTypeCount: types.length,
    addonSchemesCreated,
    minKwhFilled,
    adminFeeFilled,
  };
}

export function formatImportSummary(
  propertyId: string,
  wiped: WipeSentralandInventoryResult,
  created: { unitTypeCount: number; unitCount: number },
): string {
  return [
    `Sentraland inventory import complete for property ${propertyId}`,
    `Removed: ${wiped.reservationCount} reservation(s), ${wiped.calendarBlockCount} calendar block(s), ${wiped.icalFeedCount} iCal feed(s), ${wiped.unitCount} unit(s), ${wiped.unitTypeCount} unit type(s)`,
    `Created: ${created.unitTypeCount} unit type(s), ${created.unitCount} unit(s)`,
    `Expected: ${SENTRALAND_UNIT_TYPE_COUNT} types, ${SENTRALAND_UNIT_COUNT} units`,
    'Note: iCal export tokens were regenerated — reconfigure OTA feeds if needed.',
  ].join('\n');
}
