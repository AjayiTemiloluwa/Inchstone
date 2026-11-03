-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "replacesId" TEXT,
ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "Purse" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_userId_requestId_key" ON "FinancialEntry"("userId", "requestId");

-- CreateIndex
CREATE INDEX "FinancialEntry_userId_voidedAt_idx" ON "FinancialEntry"("userId", "voidedAt");

-- CreateIndex
CREATE INDEX "FinancialEntry_userId_groupId_idx" ON "FinancialEntry"("userId", "groupId");
