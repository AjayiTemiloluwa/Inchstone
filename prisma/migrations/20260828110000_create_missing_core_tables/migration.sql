-- Creates the tables that were added to schema.prisma by the "alarms" and
-- "long-term plans" commits but never shipped as a migration of their own.
--
-- Without this, `prisma migrate deploy` (which runs on every Vercel build)
-- failed on a fresh database at 20260828130000_alarm_tz with
-- `relation "Alarm" does not exist`, so no deployment could build a schema.
--
-- This migration is deliberately named to sort BEFORE 20260828130000_alarm_tz,
-- because that migration adds the "tz" column to "Alarm" and therefore
-- requires the table to already exist.

-- CreateTable
CREATE TABLE "Alarm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "days" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextFire" TIMESTAMP(3),
    "lastFired" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alarm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alarm_userId_enabled_idx" ON "Alarm"("userId", "enabled");

-- CreateIndex
CREATE INDEX "Alarm_enabled_nextFire_idx" ON "Alarm"("enabled", "nextFire");

-- CreateTable
CREATE TABLE "LongTermPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT NOT NULL,
    "anchorNote" TEXT,
    "reviewCadence" TEXT NOT NULL DEFAULT 'monthly',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LongTermPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LongTermPlan_userId_idx" ON "LongTermPlan"("userId");

-- CreateTable
CREATE TABLE "PlanSection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanSection_userId_planId_idx" ON "PlanSection"("userId", "planId");

-- AddForeignKey
ALTER TABLE "PlanSection" ADD CONSTRAINT "PlanSection_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LongTermPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PlanGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "overallGoal" TEXT,
    "developmentOpportunity" TEXT,
    "actionsPlanned" TEXT,
    "resourcesAndSupport" TEXT,
    "successCriteria" TEXT,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "linkedItemId" TEXT,

    CONSTRAINT "PlanGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanGoal_userId_sectionId_idx" ON "PlanGoal"("userId", "sectionId");

-- CreateIndex
CREATE INDEX "PlanGoal_linkedItemId_idx" ON "PlanGoal"("linkedItemId");

-- AddForeignKey
ALTER TABLE "PlanGoal" ADD CONSTRAINT "PlanGoal_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PlanSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PlanMilestone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "notes" TEXT,
    "linkedItemId" TEXT,

    CONSTRAINT "PlanMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanMilestone_userId_goalId_idx" ON "PlanMilestone"("userId", "goalId");

-- AddForeignKey
ALTER TABLE "PlanMilestone" ADD CONSTRAINT "PlanMilestone_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "PlanGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "StatusLogEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentType" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "note" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatusLogEntry_parentType_parentId_idx" ON "StatusLogEntry"("parentType", "parentId");

-- CreateIndex
CREATE INDEX "StatusLogEntry_userId_idx" ON "StatusLogEntry"("userId");

-- CreateTable
CREATE TABLE "ReviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "conductedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summaryNote" TEXT,

    CONSTRAINT "ReviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewSession_userId_planId_idx" ON "ReviewSession"("userId", "planId");

-- AddForeignKey
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LongTermPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
