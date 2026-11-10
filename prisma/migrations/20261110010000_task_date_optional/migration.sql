-- Frogs can be added without a day and scheduled later.
ALTER TABLE "Task" ALTER COLUMN "date" DROP NOT NULL;
