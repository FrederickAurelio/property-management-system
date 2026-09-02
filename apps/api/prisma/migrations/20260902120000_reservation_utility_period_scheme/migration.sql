-- CreateTable
CREATE TABLE "ReservationUtilityPeriodScheme" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "chargeDate" DATE NOT NULL,
    "electricityRateIdrPerKwh" INTEGER NOT NULL,
    "waterRateIdrPerM3" INTEGER NOT NULL,
    "maintenanceFeeIdrPerMonth" INTEGER NOT NULL,
    "electricityMinKwh" DECIMAL(12,3) NOT NULL,
    "adminFeeIdrPerMonth" INTEGER NOT NULL,
    "utilityAddons" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationUtilityPeriodScheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReservationUtilityPeriodScheme_reservationId_chargeDate_key" ON "ReservationUtilityPeriodScheme"("reservationId", "chargeDate");

-- CreateIndex
CREATE INDEX "ReservationUtilityPeriodScheme_reservationId_chargeDate_idx" ON "ReservationUtilityPeriodScheme"("reservationId", "chargeDate");

-- AddForeignKey
ALTER TABLE "ReservationUtilityPeriodScheme" ADD CONSTRAINT "ReservationUtilityPeriodScheme_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
