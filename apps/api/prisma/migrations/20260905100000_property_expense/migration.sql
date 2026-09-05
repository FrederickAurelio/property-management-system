-- CreateEnum
CREATE TYPE "PropertyExpenseCategory" AS ENUM ('UTILITIES', 'MAINTENANCE', 'INTERNET', 'SUPPLIES', 'STAFF', 'OTHER');

-- CreateTable
CREATE TABLE "PropertyExpense" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "category" "PropertyExpenseCategory" NOT NULL,
    "amountIdr" BIGINT NOT NULL,
    "occurredOn" DATE NOT NULL,
    "note" VARCHAR(500),
    "proofImages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByAdminId" TEXT,
    "updatedByAdminId" TEXT,

    CONSTRAINT "PropertyExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyExpense_propertyId_occurredOn_idx" ON "PropertyExpense"("propertyId", "occurredOn");

-- CreateIndex
CREATE INDEX "PropertyExpense_propertyId_category_idx" ON "PropertyExpense"("propertyId", "category");

-- CreateIndex
CREATE INDEX "PropertyExpense_unitId_idx" ON "PropertyExpense"("unitId");

-- CreateIndex
CREATE INDEX "PropertyExpense_createdByAdminId_idx" ON "PropertyExpense"("createdByAdminId");

-- AddForeignKey
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Amount must be positive (service also enforces)
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_amountIdr_positive" CHECK ("amountIdr" > 0);
