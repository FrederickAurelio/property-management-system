import { PrismaClient } from '../generated/prisma/index.js';
import {
  applySentralandInventoryReplace,
  formatImportSummary,
} from './apply-sentraland-inventory';
import {
  SENTRALAND_PROPERTY_CODE,
  SENTRALAND_UNIT_COUNT,
  SENTRALAND_UNIT_TYPE_COUNT,
} from './sentraland-inventory';

const prisma = new PrismaClient();

function isDryRun(): boolean {
  return ['1', 'true', 'yes'].includes(
    (process.env.DRY_RUN ?? '').trim().toLowerCase(),
  );
}

async function main(): Promise<void> {
  const dryRun = isDryRun();

  if (dryRun) {
    const property = await prisma.property.findUnique({
      where: { code: SENTRALAND_PROPERTY_CODE },
      select: {
        id: true,
        _count: {
          select: {
            units: true,
            unitTypes: true,
            reservations: true,
          },
        },
      },
    });

    if (!property) {
      throw new Error(
        `Property ${SENTRALAND_PROPERTY_CODE} not found. Run seed or create the property in PMS first.`,
      );
    }

    const [calendarBlockCount, icalFeedCount] = await Promise.all([
      prisma.calendarBlock.count({ where: { propertyId: property.id } }),
      prisma.unitIcalFeed.count({
        where: { unit: { propertyId: property.id } },
      }),
    ]);

    console.log('DRY_RUN=1 — no database changes will be made.');
    console.log(`Property: ${property.id} (${SENTRALAND_PROPERTY_CODE})`);
    console.log(
      `Would remove: ${property._count.reservations} reservation(s), ${calendarBlockCount} calendar block(s), ${icalFeedCount} iCal feed(s), ${property._count.units} unit(s), ${property._count.unitTypes} unit type(s)`,
    );
    console.log(
      `Would create: ${SENTRALAND_UNIT_TYPE_COUNT} unit type(s), ${SENTRALAND_UNIT_COUNT} unit(s)`,
    );
    return;
  }

  const result = await applySentralandInventoryReplace(prisma);
  console.log(
    formatImportSummary(result.propertyId, result.wiped, result.created),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
