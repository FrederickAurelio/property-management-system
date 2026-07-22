-- CreateEnum
CREATE TYPE "CalendarBlockKind" AS ENUM ('MAINTENANCE', 'OWNER', 'HOLD', 'OTHER');

-- CreateTable
CREATE TABLE "CalendarBlock" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "kind" "CalendarBlockKind" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByAdminId" TEXT,

    CONSTRAINT "CalendarBlock_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "CalendarBlock_unitId_startDate_endDate_idx" ON "CalendarBlock"("unitId", "startDate", "endDate");
CREATE INDEX "CalendarBlock_propertyId_startDate_idx" ON "CalendarBlock"("propertyId", "startDate");
CREATE INDEX "CalendarBlock_createdByAdminId_idx" ON "CalendarBlock"("createdByAdminId");

-- CHECK endDate > startDate
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_end_after_start_check"
  CHECK ("endDate" > "startDate");

-- Foreign keys
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Block↔block overlap exclusion (btree_gist already from reservations migration)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_unit_excl"
  EXCLUDE USING gist (
    "unitId" WITH =,
    daterange("startDate", "endDate", '[)') WITH &&
  );
