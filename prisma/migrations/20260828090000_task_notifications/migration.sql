-- AlterTable
ALTER TABLE "Task" ADD COLUMN "isImportant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reminderMinutes" INTEGER,
ADD COLUMN "countdownNotifiedAt" TIMESTAMP(3),
ADD COLUMN "reminderNotifiedAt" TIMESTAMP(3),
ADD COLUMN "startNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_userId_startTime_idx" ON "Task"("userId", "startTime");
