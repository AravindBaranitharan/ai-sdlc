-- AlterTable
ALTER TABLE "Finding" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "ticketId" TEXT,
ADD COLUMN     "ticketStatus" TEXT;

-- AlterTable
ALTER TABLE "TestRun" ADD COLUMN     "successCriteria" TEXT;
UPDATE "TestRun"
SET "successCriteria" = 'Journey completes successfully.'
WHERE "successCriteria" IS NULL;
ALTER TABLE "TestRun" ALTER COLUMN "successCriteria" SET DEFAULT 'Journey completes successfully.';
ALTER TABLE "TestRun" ALTER COLUMN "successCriteria" SET NOT NULL;
