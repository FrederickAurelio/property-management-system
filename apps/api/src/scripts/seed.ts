import { PrismaClient, AdminRole } from '../generated/prisma/index.js';
import * as bcrypt from 'bcrypt';
import {
  SKYBREEZE_PROPERTY_CREATE_DATA,
  createSentralandInventory,
  patchSkybreezeUtilityRates,
} from './apply-sentraland-inventory';
import {
  SENTRALAND_UNIT_COUNT,
  SENTRALAND_UNIT_TYPE_COUNT,
} from './sentraland-inventory';

const prisma = new PrismaClient();

async function seedSkybreeze(): Promise<void> {
  const property = await prisma.property.create({
    data: SKYBREEZE_PROPERTY_CREATE_DATA,
  });

  const created = await createSentralandInventory(prisma, property.id);

  console.log(
    `Seeded Skybreeze: ${property.id} (${created.unitTypeCount} unit types, ${created.unitCount} units)`,
  );
  console.log(
    `Expected: ${SENTRALAND_UNIT_TYPE_COUNT} types, ${SENTRALAND_UNIT_COUNT} units`,
  );
}

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123';
  const seedDemoInventory = ['1', 'true', 'yes'].includes(
    (process.env.SEED_DEMO_INVENTORY ?? '').trim().toLowerCase(),
  );

  const adminCount = await prisma.admin.count();
  if (adminCount === 0) {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.admin.create({
      data: {
        username,
        passwordHash,
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log(`Seeded SUPER_ADMIN: ${admin.username} (${admin.id})`);
  } else {
    console.log(`Admin table not empty (${adminCount}); skip admin seed`);
  }

  if (!seedDemoInventory) {
    console.log('SEED_DEMO_INVENTORY off; skip inventory seed');
    return;
  }

  const propertyCount = await prisma.property.count();
  if (propertyCount === 0) {
    await seedSkybreeze();
  } else {
    console.log(
      `Property table not empty (${propertyCount}); skip inventory create`,
    );
    const patchedCount = await patchSkybreezeUtilityRates(prisma);
    if (patchedCount > 0) {
      console.log(
        `Patched utility rates on ${patchedCount} Skybreeze unit type(s)`,
      );
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
