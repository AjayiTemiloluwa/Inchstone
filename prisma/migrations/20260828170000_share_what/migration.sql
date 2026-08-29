-- Per-partner sharing scopes (CSV): deeds,habits,frog
ALTER TABLE "Partner" ADD COLUMN "shareWhat" TEXT NOT NULL DEFAULT 'deeds';
