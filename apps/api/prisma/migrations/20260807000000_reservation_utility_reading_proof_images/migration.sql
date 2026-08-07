-- Garage meteran proof photos (ArchiveItem[]) on each utility reading.
ALTER TABLE "ReservationUtilityReading" ADD COLUMN "proofImages" JSONB NOT NULL DEFAULT '[]';
