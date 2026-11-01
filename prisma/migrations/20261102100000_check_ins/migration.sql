-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "mood" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "CheckIn_userId_day_idx" ON "CheckIn"("userId", "day");
-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_userId_day_key" ON "CheckIn"("userId", "day");
