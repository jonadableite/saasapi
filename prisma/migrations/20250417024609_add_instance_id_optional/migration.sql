/*
  Warnings:

  - You are about to drop the column `chatbotFlowId` on the `whatlead_campaigns` table. All the data in the column will be lost.
  - You are about to drop the `ChatSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChatbotFlow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Node` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Ticket` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_CampaignLeadToChatSession` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `createdat` on table `whatleadleads` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedat` on table `whatleadleads` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ChatSession" DROP CONSTRAINT "ChatSession_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "ChatSession" DROP CONSTRAINT "ChatSession_chatbotFlowId_fkey";

-- DropForeignKey
ALTER TABLE "ChatSession" DROP CONSTRAINT "ChatSession_leadId_fkey";

-- DropForeignKey
ALTER TABLE "ChatSession" DROP CONSTRAINT "ChatSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "ChatbotFlow" DROP CONSTRAINT "ChatbotFlow_userId_fkey";

-- DropForeignKey
ALTER TABLE "Node" DROP CONSTRAINT "Node_chatbotFlowId_fkey";

-- DropForeignKey
ALTER TABLE "_CampaignLeadToChatSession" DROP CONSTRAINT "_CampaignLeadToChatSession_A_fkey";

-- DropForeignKey
ALTER TABLE "_CampaignLeadToChatSession" DROP CONSTRAINT "_CampaignLeadToChatSession_B_fkey";

-- DropForeignKey
ALTER TABLE "whatlead_campaigns" DROP CONSTRAINT "whatlead_campaigns_chatbotFlowId_fkey";

-- AlterTable
ALTER TABLE "CampaignDispatch" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MediaStats" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MessageLog" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "WarmupStats" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "whatlead_campaign_leads" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "whatlead_campaign_statistics" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "whatlead_campaigns" DROP COLUMN "chatbotFlowId",
ADD COLUMN     "instanceId" TEXT,
ADD COLUMN     "isAiResponder" JSONB;

-- AlterTable
ALTER TABLE "whatleadleads" ALTER COLUMN "createdat" SET NOT NULL,
ALTER COLUMN "updatedat" SET NOT NULL;

-- DropTable
DROP TABLE "ChatSession";

-- DropTable
DROP TABLE "ChatbotFlow";

-- DropTable
DROP TABLE "Node";

-- DropTable
DROP TABLE "Ticket";

-- DropTable
DROP TABLE "_CampaignLeadToChatSession";

-- CreateTable
CREATE TABLE "_InstanceWarmupStats" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InstanceWarmupStats_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InstanceMediaStats" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InstanceMediaStats_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InstanceCampaigns" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InstanceCampaigns_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InstanceCampaignDispatches" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InstanceCampaignDispatches_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InstanceCampaignSchedules" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InstanceCampaignSchedules_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_InstanceWarmupStats_B_index" ON "_InstanceWarmupStats"("B");

-- CreateIndex
CREATE INDEX "_InstanceMediaStats_B_index" ON "_InstanceMediaStats"("B");

-- CreateIndex
CREATE INDEX "_InstanceCampaigns_B_index" ON "_InstanceCampaigns"("B");

-- CreateIndex
CREATE INDEX "_InstanceCampaignDispatches_B_index" ON "_InstanceCampaignDispatches"("B");

-- CreateIndex
CREATE INDEX "_InstanceCampaignSchedules_B_index" ON "_InstanceCampaignSchedules"("B");

-- CreateIndex
CREATE INDEX "whatlead_campaigns_instanceId_idx" ON "whatlead_campaigns"("instanceId");

-- AddForeignKey
ALTER TABLE "whatlead_campaigns" ADD CONSTRAINT "whatlead_campaigns_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceWarmupStats" ADD CONSTRAINT "_InstanceWarmupStats_A_fkey" FOREIGN KEY ("A") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceWarmupStats" ADD CONSTRAINT "_InstanceWarmupStats_B_fkey" FOREIGN KEY ("B") REFERENCES "WarmupStats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceMediaStats" ADD CONSTRAINT "_InstanceMediaStats_A_fkey" FOREIGN KEY ("A") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceMediaStats" ADD CONSTRAINT "_InstanceMediaStats_B_fkey" FOREIGN KEY ("B") REFERENCES "MediaStats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceCampaigns" ADD CONSTRAINT "_InstanceCampaigns_A_fkey" FOREIGN KEY ("A") REFERENCES "whatlead_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceCampaigns" ADD CONSTRAINT "_InstanceCampaigns_B_fkey" FOREIGN KEY ("B") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceCampaignDispatches" ADD CONSTRAINT "_InstanceCampaignDispatches_A_fkey" FOREIGN KEY ("A") REFERENCES "CampaignDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceCampaignDispatches" ADD CONSTRAINT "_InstanceCampaignDispatches_B_fkey" FOREIGN KEY ("B") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceCampaignSchedules" ADD CONSTRAINT "_InstanceCampaignSchedules_A_fkey" FOREIGN KEY ("A") REFERENCES "campaign_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceCampaignSchedules" ADD CONSTRAINT "_InstanceCampaignSchedules_B_fkey" FOREIGN KEY ("B") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
