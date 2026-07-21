import {
  PrismaClient,
  AdminRole,
  UnitLayout,
  UnitStatus,
} from '../src/generated/prisma/index.js';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const amenitiesStudio = {
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

const amenitiesApartment = {
  ...amenitiesStudio,
  highlights: amenitiesStudio.highlights.filter(
    (h) => h !== 'POOL_WITH_A_VIEW',
  ),
};

async function seedSkybreeze(): Promise<void> {
  const existing = await prisma.property.findUnique({
    where: { code: 'SKYBREEZE_SENTRALAND' },
  });
  if (existing) {
    console.log(`Skybreeze already seeded: ${existing.id}`);
    return;
  }

  const property = await prisma.property.create({
    data: {
      code: 'SKYBREEZE_SENTRALAND',
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
    },
  });

  const twoBr = await prisma.unitType.create({
    data: {
      propertyId: property.id,
      code: 'TWO_BR_STD',
      name: 'Two-Bedroom Standard Apartment',
      layout: UnitLayout.APARTMENT,
      sizeSqm: 36,
      bedroomCount: 2,
      bathroomCount: 1,
      maxGuests: 3,
      defaultPriceIdr: 650_000,
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
      smokingAllowed: false,
      sortOrder: 1,
      isActive: true,
    },
  });

  const threeBr = await prisma.unitType.create({
    data: {
      propertyId: property.id,
      code: 'THREE_BR_STD',
      name: 'Three-Bedroom Standard Apartment',
      layout: UnitLayout.APARTMENT,
      sizeSqm: 54,
      bedroomCount: 3,
      bathroomCount: 1,
      maxGuests: 3,
      defaultPriceIdr: 850_000,
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
      smokingAllowed: false,
      sortOrder: 2,
      isActive: true,
    },
  });

  const king = await prisma.unitType.create({
    data: {
      propertyId: property.id,
      code: 'DLX_KING_STUDIO',
      name: 'Deluxe King Studio',
      layout: UnitLayout.STUDIO,
      sizeSqm: 21,
      bedroomCount: 0,
      bathroomCount: 1,
      maxGuests: 2,
      defaultPriceIdr: 550_000,
      bedConfig: [
        { room: 'Studio', beds: [{ type: 'LARGE_DOUBLE', count: 1 }] },
      ],
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
      smokingAllowed: false,
      sortOrder: 3,
      isActive: true,
    },
  });

  const queen = await prisma.unitType.create({
    data: {
      propertyId: property.id,
      code: 'DLX_QUEEN_STUDIO',
      name: 'Deluxe Queen Studio',
      layout: UnitLayout.STUDIO,
      sizeSqm: 18,
      bedroomCount: 0,
      bathroomCount: 1,
      maxGuests: 2,
      defaultPriceIdr: 450_000,
      bedConfig: [
        { room: 'Studio', beds: [{ type: 'LARGE_DOUBLE', count: 1 }] },
      ],
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
      smokingAllowed: false,
      sortOrder: 4,
      isActive: true,
    },
  });

  const studio = await prisma.unitType.create({
    data: {
      propertyId: property.id,
      code: 'DLX_STUDIO',
      name: 'Deluxe Studio',
      layout: UnitLayout.STUDIO,
      sizeSqm: 18,
      bedroomCount: 0,
      bathroomCount: 1,
      maxGuests: 2,
      defaultPriceIdr: 400_000,
      bedConfig: [
        { room: 'Studio', beds: [{ type: 'LARGE_DOUBLE', count: 1 }] },
      ],
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
      smokingAllowed: false,
      sortOrder: 5,
      isActive: true,
    },
  });

  await prisma.unit.createMany({
    data: [
      {
        propertyId: property.id,
        unitTypeId: twoBr.id,
        code: 'B-0801',
        floor: '8',
        status: UnitStatus.ACTIVE,
        sortOrder: 1,
      },
      {
        propertyId: property.id,
        unitTypeId: twoBr.id,
        code: 'B-0802',
        floor: '8',
        status: UnitStatus.ACTIVE,
        sortOrder: 2,
      },
      {
        propertyId: property.id,
        unitTypeId: twoBr.id,
        code: 'B-0803',
        floor: '8',
        status: UnitStatus.MAINTENANCE,
        notes: 'AC servicing',
        sortOrder: 3,
      },
      {
        propertyId: property.id,
        unitTypeId: threeBr.id,
        code: 'B-1201',
        floor: '12',
        status: UnitStatus.ACTIVE,
        sortOrder: 1,
      },
      {
        propertyId: property.id,
        unitTypeId: king.id,
        code: 'DS-0501',
        floor: '5',
        status: UnitStatus.ACTIVE,
        sortOrder: 1,
      },
      {
        propertyId: property.id,
        unitTypeId: queen.id,
        code: 'DQ-0701',
        floor: '7',
        status: UnitStatus.ACTIVE,
        sortOrder: 1,
      },
      {
        propertyId: property.id,
        unitTypeId: studio.id,
        code: 'DS-0901',
        floor: '9',
        status: UnitStatus.ACTIVE,
        sortOrder: 1,
      },
      {
        propertyId: property.id,
        unitTypeId: studio.id,
        code: 'DS-0902',
        floor: '9',
        status: UnitStatus.INACTIVE,
        notes: 'Offline for renovation',
        sortOrder: 2,
      },
    ],
  });

  console.log(`Seeded Skybreeze: ${property.id} (5 unit types, 8 units)`);
}

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'superadmin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123';

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { username },
    update: {
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      username,
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`Seeded SUPER_ADMIN: ${admin.username} (${admin.id})`);

  await seedSkybreeze();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
