/*
  Warnings:

  - You are about to drop the column `icalDatesDifferDismissedAt` on the `Reservation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "icalDatesDifferDismissedAt";

-- AlterTable
ALTER TABLE "UnitType" ALTER COLUMN "monthlyPriceIdr" DROP DEFAULT,
ALTER COLUMN "yearlyPriceIdr" DROP DEFAULT;
