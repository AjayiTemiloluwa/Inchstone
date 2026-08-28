-- Deed end alarms: before-end warning lead + stamp
ALTER TABLE "Task" ADD COLUMN "endWarnMinutes" INTEGER;
ALTER TABLE "Task" ADD COLUMN "endingNotifiedAt" TIMESTAMP(3);
