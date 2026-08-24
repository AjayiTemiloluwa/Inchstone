-- CreateTable
CREATE TABLE "Purse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '👜',
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'Need',
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionAllocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionAllocation_pkey" PRIMARY KEY ("id")
);

-- AddColumn to FinancialEntry
ALTER TABLE "FinancialEntry" ADD COLUMN "comments" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "priority" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "purse" TEXT NOT NULL DEFAULT 'main';

-- Alter default currency from USD to NGN
ALTER TABLE "FinancialEntry" ALTER COLUMN "currency" SET DEFAULT 'NGN';

-- AddColumn to Note
ALTER TABLE "Note" ADD COLUMN "attachments" JSONB;
ALTER TABLE "Note" ADD COLUMN "date" TIMESTAMP(3);

-- AddColumn to Task
ALTER TABLE "Task" ADD COLUMN "color" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Purse_userId_name_key" ON "Purse"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_category_month_section_key" ON "Budget"("userId", "category", "month", "section");

-- CreateIndex
CREATE UNIQUE INDEX "SectionAllocation_userId_section_month_key" ON "SectionAllocation"("userId", "section", "month");

-- CreateIndex
CREATE INDEX "Note_userId_date_idx" ON "Note"("userId", "date");