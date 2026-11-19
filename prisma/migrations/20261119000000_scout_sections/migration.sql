-- Opportunity Cloud sections: a fuller profile (education, expertise) and per-section preferences.
-- Additive only (defaults fill existing rows), so the running app keeps working before and after.
ALTER TABLE "ScoutProfile" ADD COLUMN "education" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ScoutProfile" ADD COLUMN "expertise" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ScoutProfile" ADD COLUMN "sectionMode" TEXT NOT NULL DEFAULT 'flow';
ALTER TABLE "ScoutProfile" ADD COLUMN "sections" JSONB NOT NULL DEFAULT '{}';
