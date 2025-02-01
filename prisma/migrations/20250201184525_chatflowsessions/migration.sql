-- AlterTable
ALTER TABLE "whatlead_campaigns" ADD COLUMN     "chatbotFlowId" TEXT;

-- CreateTable
CREATE TABLE "ChatbotFlow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "position" JSONB NOT NULL,
    "chatbotFlowId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT,
    "currentNodeId" TEXT,
    "variables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "chatbotFlowId" TEXT,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CampaignLeadToChatSession" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CampaignLeadToChatSession_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CampaignLeadToChatSession_B_index" ON "_CampaignLeadToChatSession"("B");

-- AddForeignKey
ALTER TABLE "whatlead_campaigns" ADD CONSTRAINT "whatlead_campaigns_chatbotFlowId_fkey" FOREIGN KEY ("chatbotFlowId") REFERENCES "ChatbotFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotFlow" ADD CONSTRAINT "ChatbotFlow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "whatlead_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_chatbotFlowId_fkey" FOREIGN KEY ("chatbotFlowId") REFERENCES "ChatbotFlow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "whatlead_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "whatleadleads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatlead_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_chatbotFlowId_fkey" FOREIGN KEY ("chatbotFlowId") REFERENCES "ChatbotFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CampaignLeadToChatSession" ADD CONSTRAINT "_CampaignLeadToChatSession_A_fkey" FOREIGN KEY ("A") REFERENCES "whatlead_campaign_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CampaignLeadToChatSession" ADD CONSTRAINT "_CampaignLeadToChatSession_B_fkey" FOREIGN KEY ("B") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
