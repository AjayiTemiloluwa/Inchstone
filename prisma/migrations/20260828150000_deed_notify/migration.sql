-- Deed notifications: opt-in pin/countdown flag + finish-alarm stamp
ALTER TABLE "Task" ADD COLUMN "notifyDeed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Task" ADD COLUMN "finishNotifiedAt" TIMESTAMP(3);
