-- AlterTable: inventory busy end (nullable first for backfill)
ALTER TABLE "Reservation" ADD COLUMN "inventoryEndDate" DATE;

-- Backfill: DAILY + terminal M/Y → checkOutDate; occupying M/Y → FAR
UPDATE "Reservation"
SET "inventoryEndDate" = CASE
  WHEN "billingPeriod" IN ('MONTHLY', 'YEARLY')
    AND "status" IN ('UNCONFIRMED', 'CONFIRMED', 'CHECKED_IN')
  THEN DATE '9999-12-31'
  ELSE "checkOutDate"
END
WHERE "inventoryEndDate" IS NULL;

ALTER TABLE "Reservation" ALTER COLUMN "inventoryEndDate" SET NOT NULL;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_inventory_end_after_check_in"
  CHECK ("inventoryEndDate" > "checkInDate");

CREATE INDEX "Reservation_unitId_checkInDate_inventoryEndDate_idx"
  ON "Reservation"("unitId", "checkInDate", "inventoryEndDate");

CREATE INDEX "Reservation_propertyId_checkInDate_inventoryEndDate_idx"
  ON "Reservation"("propertyId", "checkInDate", "inventoryEndDate");

-- Occupying exclusion now uses inventory end (open hold for monthly/yearly)
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_unit_occupying_excl";
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_unit_occupying_excl"
  EXCLUDE USING gist (
    "unitId" WITH =,
    daterange("checkInDate", "inventoryEndDate", '[)') WITH &&
  )
  WHERE (
    "status" IN ('UNCONFIRMED', 'CONFIRMED', 'CHECKED_IN')
    AND "icalOverlapHold" = false
  );
