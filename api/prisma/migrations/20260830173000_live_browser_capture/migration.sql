ALTER TABLE "TestRun"
ADD COLUMN "browserMode" TEXT,
ADD COLUMN "browserFinalUrl" TEXT,
ADD COLUMN "browserTitle" TEXT,
ADD COLUMN "browserScreenshot" TEXT,
ADD COLUMN "browserEvidence" JSONB,
ADD COLUMN "browserCapturedAt" TIMESTAMP(3);
