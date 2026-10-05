-- An allocation now moves real money between two purses, so both ends are
-- recorded. Existing rows keep the old "allocation is a number only" meaning
-- (nothing was moved for them), so they default to Main and stay untouched.
ALTER TABLE "SectionAllocation" ADD COLUMN "sourcePurse" TEXT NOT NULL DEFAULT 'Main';
ALTER TABLE "SectionAllocation" ADD COLUMN "purse" TEXT NOT NULL DEFAULT 'Main';

-- Tags the transfer_out / transfer_in pair an allocation created, so re-setting
-- or clearing that section's plan can replace exactly those rows.
ALTER TABLE "FinancialEntry" ADD COLUMN "allocationId" TEXT;

-- CreateIndex
CREATE INDEX "FinancialEntry_userId_allocationId_idx" ON "FinancialEntry"("userId", "allocationId");