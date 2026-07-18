-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "UnitLayout" AS ENUM ('STUDIO', 'APARTMENT', 'CABIN', 'OTHER');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "checkInFrom" VARCHAR(5),
    "checkInUntil" VARCHAR(5),
    "checkOutFrom" VARCHAR(5),
    "checkOutUntil" VARCHAR(5),
    "addressLine" VARCHAR(255),
    "city" VARCHAR(128),
    "countryCode" CHAR(2),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "googlePlaceId" VARCHAR(256),
    "coverImage" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitType" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "layout" "UnitLayout" NOT NULL,
    "sizeSqm" DECIMAL(6,2),
    "bedroomCount" INTEGER NOT NULL,
    "bathroomCount" INTEGER NOT NULL DEFAULT 1,
    "maxGuests" INTEGER NOT NULL,
    "defaultPriceIdr" INTEGER NOT NULL,
    "bedConfig" JSONB NOT NULL,
    "amenities" JSONB NOT NULL,
    "media" JSONB NOT NULL,
    "description" TEXT,
    "smokingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitTypeId" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128),
    "floor" VARCHAR(16),
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_code_key" ON "Property"("code");

-- CreateIndex
CREATE INDEX "Property_isActive_idx" ON "Property"("isActive");

-- CreateIndex
CREATE INDEX "UnitType_propertyId_isActive_idx" ON "UnitType"("propertyId", "isActive");

-- CreateIndex
CREATE INDEX "UnitType_propertyId_sortOrder_idx" ON "UnitType"("propertyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "UnitType_propertyId_code_key" ON "UnitType"("propertyId", "code");

-- CreateIndex
CREATE INDEX "Unit_propertyId_status_isActive_idx" ON "Unit"("propertyId", "status", "isActive");

-- CreateIndex
CREATE INDEX "Unit_unitTypeId_isActive_idx" ON "Unit"("unitTypeId", "isActive");

-- CreateIndex
CREATE INDEX "Unit_propertyId_unitTypeId_idx" ON "Unit"("propertyId", "unitTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_propertyId_code_key" ON "Unit"("propertyId", "code");

-- AddForeignKey
ALTER TABLE "UnitType" ADD CONSTRAINT "UnitType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_unitTypeId_fkey" FOREIGN KEY ("unitTypeId") REFERENCES "UnitType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
