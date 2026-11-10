-- The last time a paired phone fetched its widget data (Settings → Widget shows "Phone last synced …").
ALTER TABLE "WidgetConfig" ADD COLUMN "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "WidgetConfig" ADD COLUMN "lastSyncAgent" TEXT;
