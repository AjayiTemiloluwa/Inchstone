-- CreateTable
CREATE TABLE "LearningTrack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "goal" TEXT,
    "emoji" TEXT,
    "targetDate" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearningTrack_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "LearningSection" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "concepts" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearningSection_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "LearningMaterial" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "content" TEXT,
    "fileName" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "data" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningMaterial_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReview" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "LearningTrack_userId_archived_idx" ON "LearningTrack"("userId", "archived");
-- CreateIndex
CREATE INDEX "LearningSection_trackId_order_idx" ON "LearningSection"("trackId", "order");
-- CreateIndex
CREATE INDEX "LearningSection_userId_idx" ON "LearningSection"("userId");
-- CreateIndex
CREATE INDEX "LearningMaterial_sectionId_idx" ON "LearningMaterial"("sectionId");
-- CreateIndex
CREATE INDEX "Flashcard_sectionId_idx" ON "Flashcard"("sectionId");
-- CreateIndex
CREATE INDEX "Flashcard_userId_due_idx" ON "Flashcard"("userId", "due");
-- AddForeignKey
ALTER TABLE "LearningSection" ADD CONSTRAINT "LearningSection_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "LearningTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LearningSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LearningSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
