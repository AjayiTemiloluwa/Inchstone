-- Reflection: user-saved reflection templates reusable across time periods
CREATE TABLE "Reflection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT,
    "timePeriod" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reflection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reflection_userId_timePeriod_periodKey_idx" ON "Reflection"("userId", "timePeriod", "periodKey");

-- CreateIndex
CREATE INDEX "Reflection_userId_itemId_idx" ON "Reflection"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "Reflection" ADD CONSTRAINT "Reflection_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Item.reflections is a virtual relation — no column added to Item; it is resolved
-- via Reflection.itemId foreign key above.
