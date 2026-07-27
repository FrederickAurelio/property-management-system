-- AlterEnum
ALTER TYPE "IcalSyncWarning" ADD VALUE 'UNIT_DIFFER';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "icalObservedUnitId" TEXT;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_icalObservedUnitId_fkey" FOREIGN KEY ("icalObservedUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Reservation_icalObservedUnitId_idx" ON "Reservation"("icalObservedUnitId");
