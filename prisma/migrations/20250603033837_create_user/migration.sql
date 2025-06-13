-- AlterTable
ALTER TABLE "whatlead_users" ADD COLUMN     "evoAiClientId" TEXT,
ADD COLUMN     "evoAiUserId" TEXT,
ADD COLUMN     "image" TEXT;

-- CreateIndex
CREATE INDEX "Instance_instanceName_idx" ON "Instance"("instanceName");

-- CreateIndex
CREATE INDEX "Instance_connectionStatus_idx" ON "Instance"("connectionStatus");
