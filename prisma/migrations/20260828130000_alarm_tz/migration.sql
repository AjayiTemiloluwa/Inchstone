-- Alarms fire in the user's timezone, not the server's.
ALTER TABLE "Alarm" ADD COLUMN "tz" TEXT;
