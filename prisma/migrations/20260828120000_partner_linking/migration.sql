-- Partner linking + consent sharing
ALTER TABLE "Partner" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'accepted',
ADD COLUMN "inviteCode" TEXT,
ADD COLUMN "connectionUserId" TEXT,
ADD COLUMN "shareProgress" BOOLEAN NOT NULL DEFAULT false;

-- Profile identity map (Clerk userId <-> email)
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");
CREATE UNIQUE INDEX "Partner_inviteCode_key" ON "Partner"("inviteCode");
CREATE INDEX "Partner_connectionUserId_idx" ON "Partner"("connectionUserId");
CREATE INDEX "Partner_email_idx" ON "Partner"("email");
