-- CreateIndex
CREATE INDEX "Reservation_propertyId_checkInDate_checkOutDate_idx" ON "Reservation"("propertyId", "checkInDate", "checkOutDate");
