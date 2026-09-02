-- CreateTable
CREATE TABLE "UtilityStatementBankAccount" (
    "id" TEXT NOT NULL,
    "bankName" VARCHAR(128) NOT NULL,
    "accountName" VARCHAR(128) NOT NULL,
    "accountNumber" VARCHAR(32) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityStatementBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UtilityStatementBankAccount_bankName_accountName_accountNumber_key" ON "UtilityStatementBankAccount"("bankName", "accountName", "accountNumber");

-- CreateIndex
CREATE INDEX "UtilityStatementBankAccount_lastUsedAt_idx" ON "UtilityStatementBankAccount"("lastUsedAt");
