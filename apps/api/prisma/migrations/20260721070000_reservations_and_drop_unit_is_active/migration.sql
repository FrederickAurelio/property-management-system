-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('MANUAL', 'WEBSITE', 'BOOKING_COM', 'AIRBNB', 'AGODA');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('UNCONFIRMED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'DEPOSIT', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CollectedVia" AS ENUM ('PROPERTY', 'CHANNEL', 'MIXED');

-- CreateEnum
CREATE TYPE "PaymentMovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "PaymentMovementKind" AS ENUM ('DEPOSIT', 'TOP_UP', 'REFUND', 'CANCEL_REFUND', 'CHANNEL_SETTLED');

-- CreateEnum
CREATE TYPE "IcalSyncWarning" AS ENUM ('MISSING_FROM_FEED', 'DATES_DIFFER');

-- Normalize Unit.isActive → status before drop
UPDATE "Unit"
SET "status" = 'INACTIVE'
WHERE "isActive" = false AND "status" = 'ACTIVE';

-- DropIndex
DROP INDEX IF EXISTS "Unit_propertyId_status_isActive_idx";
DROP INDEX IF EXISTS "Unit_unitTypeId_isActive_idx";

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "isActive";

-- CreateIndex
CREATE INDEX "Unit_propertyId_status_idx" ON "Unit"("propertyId", "status");
CREATE INDEX "Unit_unitTypeId_idx" ON "Unit"("unitTypeId");

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitTypeId" TEXT NOT NULL,
    "source" "ReservationSource" NOT NULL,
    "status" "ReservationStatus" NOT NULL,
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "guestName" VARCHAR(128) NOT NULL,
    "guestEmail" VARCHAR(255),
    "guestPhone" VARCHAR(32),
    "guestCount" INTEGER,
    "notes" TEXT,
    "totalAmountIdr" BIGINT,
    "paidAmountIdr" BIGINT NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL,
    "collectedVia" "CollectedVia",
    "externalRef" VARCHAR(256),
    "icalSyncWarning" "IcalSyncWarning",
    "icalSyncWarnedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByAdminId" TEXT,
    "updatedByAdminId" TEXT,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Reservation_dates_check" CHECK ("checkOutDate" > "checkInDate")
);

-- CreateTable
CREATE TABLE "PaymentMovement" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "direction" "PaymentMovementDirection" NOT NULL,
    "kind" "PaymentMovementKind" NOT NULL,
    "amountIdr" BIGINT NOT NULL,
    "signedAmount" BIGINT NOT NULL,
    "method" "CollectedVia",
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAdminId" TEXT,

    CONSTRAINT "PaymentMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentMovement_amount_positive" CHECK ("amountIdr" > 0),
    CONSTRAINT "PaymentMovement_signed_matches" CHECK (
      ("direction" = 'IN' AND "signedAmount" = "amountIdr")
      OR ("direction" = 'OUT' AND "signedAmount" = -"amountIdr")
    )
);

-- CreateIndex
CREATE INDEX "Reservation_unitId_checkInDate_checkOutDate_idx" ON "Reservation"("unitId", "checkInDate", "checkOutDate");
CREATE INDEX "Reservation_propertyId_checkInDate_idx" ON "Reservation"("propertyId", "checkInDate");
CREATE INDEX "Reservation_propertyId_checkOutDate_idx" ON "Reservation"("propertyId", "checkOutDate");
CREATE INDEX "Reservation_propertyId_status_idx" ON "Reservation"("propertyId", "status");
CREATE INDEX "Reservation_source_idx" ON "Reservation"("source");
CREATE INDEX "Reservation_createdByAdminId_idx" ON "Reservation"("createdByAdminId");
CREATE INDEX "Reservation_updatedByAdminId_idx" ON "Reservation"("updatedByAdminId");

-- Unique (source, externalRef) when externalRef is set
CREATE UNIQUE INDEX "Reservation_source_externalRef_key"
  ON "Reservation"("source", "externalRef")
  WHERE "externalRef" IS NOT NULL;

CREATE INDEX "PaymentMovement_reservationId_createdAt_idx" ON "PaymentMovement"("reservationId", "createdAt");
CREATE INDEX "PaymentMovement_createdByAdminId_idx" ON "PaymentMovement"("createdByAdminId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_unitTypeId_fkey" FOREIGN KEY ("unitTypeId") REFERENCES "UnitType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentMovement" ADD CONSTRAINT "PaymentMovement_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentMovement" ADD CONSTRAINT "PaymentMovement_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Occupying overlap exclusion (UNCONFIRMED | CONFIRMED | CHECKED_IN)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_unit_occupying_excl"
  EXCLUDE USING gist (
    "unitId" WITH =,
    daterange("checkInDate", "checkOutDate", '[)') WITH &&
  )
  WHERE ("status" IN ('UNCONFIRMED', 'CONFIRMED', 'CHECKED_IN'));
