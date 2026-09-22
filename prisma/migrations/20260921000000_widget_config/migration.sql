-- WidgetConfig: per-user design + secret for the native home-screen widget app
CREATE TABLE "WidgetConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "pages" JSONB NOT NULL DEFAULT '[]',
    "rotateSeconds" INTEGER NOT NULL DEFAULT 15,
    "showAlarms" BOOLEAN NOT NULL DEFAULT true,
    "showMessages" BOOLEAN NOT NULL DEFAULT true,
    "showPlan" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WidgetConfig_userId_key" ON "WidgetConfig"("userId");
CREATE UNIQUE INDEX "WidgetConfig_secret_key" ON "WidgetConfig"("secret");