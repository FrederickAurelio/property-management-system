-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "icalOverlapHold" BOOLEAN NOT NULL DEFAULT false;

-- Occupying exclusion: overlap-hold stubs do not participate
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_unit_occupying_excl";
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_unit_occupying_excl"
  EXCLUDE USING gist (
    "unitId" WITH =,
    daterange("checkInDate", "checkOutDate", '[)') WITH &&
  )
  WHERE (
    "status" IN ('UNCONFIRMED', 'CONFIRMED', 'CHECKED_IN')
    AND "icalOverlapHold" = false
  );
