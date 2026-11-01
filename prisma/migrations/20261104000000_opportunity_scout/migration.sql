-- CreateTable
CREATE TABLE "ScoutProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interests" TEXT NOT NULL DEFAULT '',
    "homeCountry" TEXT NOT NULL DEFAULT 'Nigeria',
    "types" TEXT NOT NULL DEFAULT 'scholarship,fellowship,job,internship,grant,competition',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "builtIn" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastRunNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoutProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "scope" TEXT NOT NULL DEFAULT 'global',
    "location" TEXT,
    "deadline" TIMESTAMP(3),
    "value" TEXT,
    "summary" TEXT,
    "eligibility" TEXT,
    "source" TEXT,
    "match" INTEGER NOT NULL DEFAULT 50,
    "matchReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "applicationId" TEXT,
    "emailedAt" TIMESTAMP(3),
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoutProfile_userId_key" ON "ScoutProfile"("userId");

-- CreateIndex
CREATE INDEX "Opportunity_userId_status_idx" ON "Opportunity"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_userId_url_key" ON "Opportunity"("userId", "url");

