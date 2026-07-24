-- CreateEnum
CREATE TYPE "StayBillingPeriod" AS ENUM ('DAILY', 'MONTHLY', 'YEARLY');

-- AlterTable UnitType — rack rates for monthly / yearly stays
ALTER TABLE "UnitType" ADD COLUMN "monthlyPriceIdr" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UnitType" ADD COLUMN "yearlyPriceIdr" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Reservation
ALTER TABLE "Reservation" ADD COLUMN "billingPeriod" "StayBillingPeriod" NOT NULL DEFAULT 'DAILY';
