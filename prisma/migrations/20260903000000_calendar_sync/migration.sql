-- Google Calendar sync: mode choice (pull-only | two-way) + idempotent pull
-- and two-way push link fields on Task.

-- UserToken: how the user chose their sync + granted scopes + last successful sync
ALTER TABLE "UserToken" ADD COLUMN "syncMode" TEXT NOT NULL DEFAULT 'pull';
ALTER TABLE "UserToken" ADD COLUMN "scopes" TEXT;
ALTER TABLE "UserToken" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

-- Event: googleEventId upserts pulls (resync never duplicates), recurringEventId links
-- an expanded occurrence back to its master series event.

ALTER TABLE "Event" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "Event" ADD COLUMN "recurringEventId" TEXT;
CREATE UNIQUE INDEX "Event_userId_googleEventId_key" ON "Event"("userId", "googleEventId");
CREATE INDEX "Event_userId_startTime_idx" ON "Event"("userId", "startTime");

-- Task: id of the Google event a scheduled deed was pushed to (single id for
-- one-shots; googleRecurringEventId for recurring deeds' master RRULE event).
ALTER TABLE "Task" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "Task" ADD COLUMN "googleRecurringEventId" TEXT;