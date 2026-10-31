-- Application Tracker: applications, their requirement/document/step items, and uploaded files.
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "type" TEXT NOT NULL DEFAULT 'other',
    "status" TEXT NOT NULL DEFAULT 'researching',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "url" TEXT,
    "location" TEXT,
    "value" TEXT,
    "summary" TEXT,
    "whyApply" TEXT,
    "notes" TEXT,
    "details" JSONB NOT NULL DEFAULT '[]',
    "contacts" JSONB NOT NULL DEFAULT '[]',
    "opensAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "decisionDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reminderOffsets" TEXT NOT NULL DEFAULT '10080,4320,1440,180',
    "remindersSent" TEXT NOT NULL DEFAULT '',
    "tz" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationItem" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dueDate" TIMESTAMP(3),
    "fileId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationFile" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "label" TEXT,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Application_userId_archived_idx" ON "Application"("userId", "archived");
CREATE INDEX "Application_deadline_idx" ON "Application"("deadline");
CREATE INDEX "ApplicationItem_applicationId_kind_idx" ON "ApplicationItem"("applicationId", "kind");
CREATE INDEX "ApplicationFile_applicationId_idx" ON "ApplicationFile"("applicationId");

ALTER TABLE "ApplicationItem" ADD CONSTRAINT "ApplicationItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationFile" ADD CONSTRAINT "ApplicationFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
