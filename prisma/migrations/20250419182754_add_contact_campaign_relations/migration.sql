/*
  Warnings:

  - You are about to drop the `_InstanceCampaignDispatches` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_InstanceCampaignSchedules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_InstanceCampaigns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_InstanceMediaStats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_InstanceWarmupStats` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `lastMessageAt` on table `Conversation` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "_InstanceCampaignDispatches" DROP CONSTRAINT "_InstanceCampaignDispatches_A_fkey";

-- DropForeignKey
ALTER TABLE "_InstanceCampaignDispatches" DROP CONSTRAINT "_InstanceCampaignDispatches_B_fkey";

-- DropForeignKey
ALTER TABLE "_InstanceCampaignSchedules" DROP CONSTRAINT "_InstanceCampaignSchedules_A_fkey";

-- DropForeignKey
ALTER TABLE "_InstanceCampaignSchedules" DROP CONSTRAINT "_InstanceCampaignSchedules_B_fkey";

-- DropForeignKey
ALTER TABLE "_InstanceCampaigns" DROP CONSTRAINT "_InstanceCampaigns_A_fkey";

-- DropForeignKey
ALTER TABLE "_InstanceCampaigns" DROP CONSTRAINT "_InstanceCampaigns_B_fkey";

-- DropForeignKey
ALTER TABLE "_InstanceMediaStats" DROP CONSTRAINT "_InstanceMediaStats_A_fkey";

-- DropForeignKey
ALTER TABLE "_InstanceMediaStats" DROP CONSTRAINT "_InstanceMediaStats_B_fkey";

-- DropForeignKey
ALTER TABLE "_InstanceWarmupStats" DROP CONSTRAINT "_InstanceWarmupStats_A_fkey";

-- DropForeignKey
ALTER TABLE "_InstanceWarmupStats" DROP CONSTRAINT "_InstanceWarmupStats_B_fkey";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "tags" JSONB,
ALTER COLUMN "lastMessageAt" SET NOT NULL,
ALTER COLUMN "lastMessageAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "whatlead_campaign_leads" ADD COLUMN     "syncedAt" TIMESTAMP(3),
ADD COLUMN     "syncedWithCRM" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "_InstanceCampaignDispatches";

-- DropTable
DROP TABLE "_InstanceCampaignSchedules";

-- DropTable
DROP TABLE "_InstanceCampaigns";

-- DropTable
DROP TABLE "_InstanceMediaStats";

-- DropTable
DROP TABLE "_InstanceWarmupStats";

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "avatar" TEXT,
    "tags" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ContactCampaigns" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContactCampaigns_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_phone_key" ON "contacts"("phone");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "_ContactCampaigns_B_index" ON "_ContactCampaigns"("B");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactPhone_fkey" FOREIGN KEY ("contactPhone") REFERENCES "contacts"("phone") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactCampaigns" ADD CONSTRAINT "_ContactCampaigns_A_fkey" FOREIGN KEY ("A") REFERENCES "whatlead_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactCampaigns" ADD CONSTRAINT "_ContactCampaigns_B_fkey" FOREIGN KEY ("B") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
