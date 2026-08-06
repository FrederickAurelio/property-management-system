-- CreateEnum
CREATE TYPE "UtilityKind" AS ENUM ('ELECTRICITY', 'WATER');

-- AlterTable UnitType — utility rate defaults
ALTER TABLE "UnitType" ADD COLUMN "electricityRateIdrPerKwh" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UnitType" ADD COLUMN "waterRateIdrPerM3" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UnitType" ADD COLUMN "maintenanceFeeIdrPerMonth" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Reservation — rent split + utility denorms + rate snapshots
ALTER TABLE "Reservation" ADD COLUMN "rentAmountIdr" BIGINT;
ALTER TABLE "Reservation" ADD COLUMN "electricityAmountIdr" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "waterAmountIdr" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "maintenanceAmountIdr" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "electricityRateIdrPerKwh" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "waterRateIdrPerM3" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "maintenanceFeeIdrPerMonth" INTEGER NOT NULL DEFAULT 0;

-- Backfill rent from existing total; copy rates from unit type
UPDATE "Reservation" AS r
SET
  "rentAmountIdr" = r."totalAmountIdr",
  "electricityRateIdrPerKwh" = ut."electricityRateIdrPerKwh",
  "waterRateIdrPerM3" = ut."waterRateIdrPerM3",
  "maintenanceFeeIdrPerMonth" = ut."maintenanceFeeIdrPerMonth"
FROM "UnitType" AS ut
WHERE r."unitTypeId" = ut."id";

-- CreateTable
CREATE TABLE "ReservationUtilityReading" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "utility" "UtilityKind" NOT NULL,
    "readingDate" DATE NOT NULL,
    "meterValue" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAdminId" TEXT,

    CONSTRAINT "ReservationUtilityReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationMaintenanceCharge" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "chargeDate" DATE NOT NULL,
    "amountIdr" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAdminId" TEXT,

    CONSTRAINT "ReservationMaintenanceCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReservationUtilityReading_reservationId_utility_readingDate_key" ON "ReservationUtilityReading"("reservationId", "utility", "readingDate");

-- CreateIndex
CREATE INDEX "ReservationUtilityReading_reservationId_utility_readingDate_idx" ON "ReservationUtilityReading"("reservationId", "utility", "readingDate");

-- CreateIndex
CREATE INDEX "ReservationUtilityReading_createdByAdminId_idx" ON "ReservationUtilityReading"("createdByAdminId");

-- CreateIndex
CREATE INDEX "ReservationMaintenanceCharge_reservationId_chargeDate_idx" ON "ReservationMaintenanceCharge"("reservationId", "chargeDate");

-- CreateIndex
CREATE INDEX "ReservationMaintenanceCharge_createdByAdminId_idx" ON "ReservationMaintenanceCharge"("createdByAdminId");

-- AddForeignKey
ALTER TABLE "ReservationUtilityReading" ADD CONSTRAINT "ReservationUtilityReading_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationUtilityReading" ADD CONSTRAINT "ReservationUtilityReading_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReservationMaintenanceCharge" ADD CONSTRAINT "ReservationMaintenanceCharge_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationMaintenanceCharge" ADD CONSTRAINT "ReservationMaintenanceCharge_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
