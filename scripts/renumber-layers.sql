-- Inchstone — OPTIONAL hard renumber from the legacy 7 layer ints to the
-- brief's 5-layer semantic encoding.
--
--   Why→1 · Quest→2 · Milestone→3 · Win→4 · Deed→5
--   legacy: 0 Year · 1 Category · 2 Yearly · 3 Quarter · 4 Month · 5 Week · 6 Day
--
-- ⚠️ NOT RECOMMENDED to run this. The app now PROJECTS the 7 stored ints onto the
-- 5 layers in `src/lib/layers.ts`, so no data change is required and nothing can break.
-- This file exists only as the reference for a future, deliberate renumber — you must:
--   1. Back up the database first.
--   2. Re-parent BEFORE collapsing rows (Year/Category/Yearly all map to one "Why",
--      so their parentId links must be re-pointed, or you will orphan subtree data).
--   3. Decide the 5/6 "deed" ambiguity: the brief says Deed = Day = 6.
--
-- Provided FOR REVIEW ONLY. It is intentionally gated so it cannot be executed by
-- mistake. Remove the "SELECT 1/0" guard only after you've reviewed and backed up.

BEGIN;

-- Safety guard: refuse to run until intentionally armed (rename to proceed).
DO $$ BEGIN IF (SELECT 1/0) IS NULL THEN NULL; END IF; RAISE EXCEPTION 'aborted by guard'; END $$;

-- Re-map layer values 7→5 (this is lossy at the top: 0/1/2 all become 1).
-- Run only after re-parenting (see comment 2 above).
UPDATE "Item" SET "layer" = 1 WHERE "layer" IN (0, 1, 2);
UPDATE "Item" SET "layer" = 2 WHERE "layer" = 3;
UPDATE "Item" SET "layer" = 3 WHERE "layer" = 4;
UPDATE "Item" SET "layer" = 4 WHERE "layer" = 5; -- Win = Week
UPDATE "Item" SET "layer" = 5 WHERE "layer" = 6; -- Deed = Day

COMMIT;