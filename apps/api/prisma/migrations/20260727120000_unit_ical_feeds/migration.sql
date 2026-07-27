-- AlterTable: Unit.icalExportToken (backfill existing rows)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "Unit" ADD COLUMN "icalExportToken" VARCHAR(64);

UPDATE "Unit"
SET "icalExportToken" = encode(gen_random_bytes(24), 'hex')
WHERE "icalExportToken" IS NULL;

ALTER TABLE "Unit" ALTER COLUMN "icalExportToken" SET NOT NULL;

CREATE UNIQUE INDEX "Unit_icalExportToken_key" ON "Unit"("icalExportToken");

-- CreateTable: UnitIcalFeed
CREATE TABLE "UnitIcalFeed" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "source" "ReservationSource" NOT NULL,
    "importUrl" VARCHAR(2048) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPulledAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitIcalFeed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnitIcalFeed_unitId_source_key" ON "UnitIcalFeed"("unitId", "source");

CREATE INDEX "UnitIcalFeed_isActive_lastPulledAt_idx" ON "UnitIcalFeed"("isActive", "lastPulledAt");

ALTER TABLE "UnitIcalFeed" ADD CONSTRAINT "UnitIcalFeed_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
