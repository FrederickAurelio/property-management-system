-- CreateEnum
CREATE TYPE "UtilityAddonKind" AS ENUM ('CONSTANT', 'PERCENT');

-- AlterTable UnitType — electricity min kWh + admin fee
ALTER TABLE "UnitType" ADD COLUMN "electricityMinKwh" DECIMAL(12,3) NOT NULL DEFAULT 0;
ALTER TABLE "UnitType" ADD COLUMN "adminFeeIdrPerMonth" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Reservation — min kWh / admin snapshots + frozen add-ons + denorm
ALTER TABLE "Reservation" ADD COLUMN "electricityMinKwh" DECIMAL(12,3) NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "adminFeeIdrPerMonth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "utilityAddons" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Reservation" ADD COLUMN "adminAmountIdr" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UnitTypeUtilityAddon" (
    "id" TEXT NOT NULL,
    "unitTypeId" TEXT NOT NULL,
    "utility" "UtilityKind" NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "kind" "UtilityAddonKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitTypeUtilityAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationAdminCharge" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "chargeDate" DATE NOT NULL,
    "amountIdr" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAdminId" TEXT,

    CONSTRAINT "ReservationAdminCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitTypeUtilityAddon_unitTypeId_utility_sortOrder_idx" ON "UnitTypeUtilityAddon"("unitTypeId", "utility", "sortOrder");

-- CreateIndex
CREATE INDEX "ReservationAdminCharge_reservationId_chargeDate_idx" ON "ReservationAdminCharge"("reservationId", "chargeDate");

-- CreateIndex
CREATE INDEX "ReservationAdminCharge_createdByAdminId_idx" ON "ReservationAdminCharge"("createdByAdminId");

-- AddForeignKey
ALTER TABLE "UnitTypeUtilityAddon" ADD CONSTRAINT "UnitTypeUtilityAddon_unitTypeId_fkey" FOREIGN KEY ("unitTypeId") REFERENCES "UnitType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationAdminCharge" ADD CONSTRAINT "ReservationAdminCharge_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationAdminCharge" ADD CONSTRAINT "ReservationAdminCharge_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
