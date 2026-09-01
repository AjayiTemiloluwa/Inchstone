-- ChallengeBottle: a named accumulator poured into via @-mentions in reflections
CREATE TABLE "ChallengeBottle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "unit" TEXT,
    "target" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeBottle_pkey" PRIMARY KEY ("id")
);

-- BottleEntry: one poured amount into a bottle
CREATE TABLE "BottleEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bottleId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "sourceType" TEXT,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BottleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChallengeBottle_userId_idx" ON "ChallengeBottle"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeBottle_userId_name_key" ON "ChallengeBottle"("userId", "name");

-- CreateIndex
CREATE INDEX "BottleEntry_userId_bottleId_idx" ON "BottleEntry"("userId", "bottleId");

-- CreateIndex
CREATE INDEX "BottleEntry_bottleId_createdAt_idx" ON "BottleEntry"("bottleId", "createdAt");

-- AddForeignKey
ALTER TABLE "BottleEntry" ADD CONSTRAINT "BottleEntry_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "ChallengeBottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dedupe key so re-saving the same reflection never double-pours the same amount
ALTER TABLE "BottleEntry" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "BottleEntry_userId_dedupeKey_key" ON "BottleEntry"("userId", "dedupeKey");
