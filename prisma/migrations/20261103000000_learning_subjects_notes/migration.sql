-- AlterTable
ALTER TABLE "LearningTrack" ADD COLUMN     "inOrder" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "LearningMaterial" ADD COLUMN     "extractedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

