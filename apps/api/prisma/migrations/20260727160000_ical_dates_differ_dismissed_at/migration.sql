-- Sticky Keep for DATES_DIFFER (parallel to icalOtaStillListedDismissedAt)
ALTER TABLE "Reservation" ADD COLUMN "icalDatesDifferDismissedAt" TIMESTAMP(3);
