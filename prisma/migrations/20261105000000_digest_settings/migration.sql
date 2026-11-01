-- AlterTable
ALTER TABLE "ScoutProfile" ADD COLUMN     "digestDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "digestFrequency" TEXT NOT NULL DEFAULT 'daily',
ADD COLUMN     "digestHour" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "digestMax" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "digestMinMatch" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "digestOnlyNew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "digestScope" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "digestSentAt" TIMESTAMP(3),
ADD COLUMN     "digestTypes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tz" TEXT NOT NULL DEFAULT 'Africa/Lagos';

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "emailSkip" BOOLEAN NOT NULL DEFAULT false;

