-- Challenge statement + optional deadline attached to a bottle
ALTER TABLE "ChallengeBottle" ADD COLUMN "challenge" TEXT;
ALTER TABLE "ChallengeBottle" ADD COLUMN "challengeDue" TIMESTAMP(3);
