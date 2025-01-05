-- AlterTable
ALTER TABLE "MediaStats" ADD COLUMN     "totalReceived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalSent" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "date" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "MediaStats_instanceName_idx" ON "MediaStats"("instanceName");

-- CreateIndex
CREATE INDEX "MediaStats_date_idx" ON "MediaStats"("date");
