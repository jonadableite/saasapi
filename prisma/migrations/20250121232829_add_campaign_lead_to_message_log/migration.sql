-- CreateTable
CREATE TABLE "whatlead_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatlead_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatlead_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeSubscriptionStatus" TEXT,
    "active" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whatleadCompanyId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" BOOLEAN NOT NULL DEFAULT true,
    "maxInstances" INTEGER NOT NULL DEFAULT 2,
    "messagesPerDay" INTEGER NOT NULL DEFAULT 20,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "support" TEXT NOT NULL DEFAULT 'basic',
    "trialEndDate" TIMESTAMP(3),

    CONSTRAINT "whatlead_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatleadparceiroconfigs" (
    "id" TEXT NOT NULL,
    "createdAt" DATE,
    "name" TEXT,
    "productdefault" TEXT,
    "campaignstatus" TEXT,
    "enablecuration" BOOLEAN,
    "enabletosendustolead" BOOLEAN,
    "enabled" BOOLEAN,
    "isconversationia" BOOLEAN,
    "campaignnumberbusiness" TEXT,
    "whatsappprovider" TEXT,
    "enabletosendprovider" BOOLEAN,
    "enabletosecondcallprovider" BOOLEAN,
    "integrationconfiguration" JSONB,
    "integrationname" TEXT,
    "templatelistvars" JSONB[],
    "metaconfiguration" JSONB,
    "messageperruns" JSONB[],
    "notifyconfiguration" JSONB,
    "updatedAt" DATE,
    "whitelabel_config" TEXT NOT NULL,
    "whatleadCompanyId" TEXT,

    CONSTRAINT "whatleadparceiroconfigs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatleadleads" (
    "id" TEXT NOT NULL,
    "externalid" TEXT,
    "sourceid" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "lastmessagesent" TIMESTAMP(3),
    "stepsecondcalltemplate" INTEGER,
    "stepnointeraction" INTEGER,
    "nointeractionquantity" INTEGER,
    "accepttemplate" BOOLEAN,
    "acceptsecondtemplate" BOOLEAN,
    "status" TEXT,
    "dialog" JSONB[],
    "configid" TEXT NOT NULL,
    "whitelabelconfig" TEXT NOT NULL,
    "lastintent" TEXT,
    "broker" TEXT,
    "origin" TEXT,
    "send" BOOLEAN,
    "sendAt" TIMESTAMP(3),
    "isBusinessAutoResponder" BOOLEAN DEFAULT false,
    "startmessage" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "schedulingdata" TEXT,
    "productchoosebyclient" TEXT,
    "productid" INTEGER,
    "createdat" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedat" TIMESTAMP(3),
    "curation" JSONB,

    CONSTRAINT "whatleadleads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "stripePaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "customerId" TEXT,
    "metadata" JSONB,
    "disputeStatus" TEXT,
    "disputeReason" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL DEFAULT 'pending',
    "number" TEXT,
    "ownerJid" TEXT,
    "profilePicUrl" TEXT,
    "integration" TEXT NOT NULL DEFAULT 'WHATSAPP-BAILEYS',
    "token" TEXT,
    "clientName" TEXT,
    "profileName" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disconnectedAt" TIMESTAMP(3),
    "disconnectionObject" JSONB,
    "disconnectionReasonCode" TEXT,
    "proxyConfig" JSONB,
    "typebot" JSONB,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaStats" (
    "id" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" INTEGER NOT NULL DEFAULT 0,
    "image" INTEGER NOT NULL DEFAULT 0,
    "video" INTEGER NOT NULL DEFAULT 0,
    "audio" INTEGER NOT NULL DEFAULT 0,
    "sticker" INTEGER NOT NULL DEFAULT 0,
    "reaction" INTEGER NOT NULL DEFAULT 0,
    "isReceived" BOOLEAN NOT NULL DEFAULT false,
    "totalDaily" INTEGER NOT NULL DEFAULT 0,
    "totalAllTime" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarmupStats" (
    "id" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paused',
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesReceived" INTEGER NOT NULL DEFAULT 0,
    "warmupTime" INTEGER NOT NULL DEFAULT 0,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startTime" TIMESTAMP(3),
    "pauseTime" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mediaStatsId" TEXT,
    "mediaReceivedId" TEXT,

    CONSTRAINT "WarmupStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatlead_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "type" TEXT NOT NULL,
    "message" TEXT,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "mediaCaption" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "scheduledStatus" TEXT DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "minDelay" INTEGER NOT NULL DEFAULT 5,
    "maxDelay" INTEGER NOT NULL DEFAULT 30,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatlead_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignDispatch" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatlead_campaign_messages" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatlead_campaign_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatlead_campaign_leads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatlead_campaign_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_schedules" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "mediaType" TEXT,
    "mediaUrl" TEXT,
    "mediaCaption" TEXT,
    "minDelay" INTEGER NOT NULL DEFAULT 5,
    "maxDelay" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "campaign_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatlead_campaign_statistics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatlead_campaign_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignLeadId" TEXT NOT NULL,
    "leadId" TEXT,
    "messageId" TEXT NOT NULL,
    "messageDate" TIMESTAMP(3) NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusHistory" JSONB[],
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAnalytics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "respondedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MessageAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignErrorLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatlead_companies_createdAt_idx" ON "whatlead_companies"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "whatlead_users_email_key" ON "whatlead_users"("email");

-- CreateIndex
CREATE INDEX "whatlead_users_email_profile_phone_createdAt_idx" ON "whatlead_users"("email", "profile", "phone", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "whatleadparceiroconfigs_campaignnumberbusiness_key" ON "whatleadparceiroconfigs"("campaignnumberbusiness");

-- CreateIndex
CREATE INDEX "whatleadleads_phone_configid_idx" ON "whatleadleads"("phone", "configid");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentId_key" ON "Payment"("stripePaymentId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_instanceName_key" ON "Instance"("instanceName");

-- CreateIndex
CREATE INDEX "Instance_userId_idx" ON "Instance"("userId");

-- CreateIndex
CREATE INDEX "MediaStats_instanceName_idx" ON "MediaStats"("instanceName");

-- CreateIndex
CREATE INDEX "MediaStats_date_idx" ON "MediaStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WarmupStats_instanceName_key" ON "WarmupStats"("instanceName");

-- CreateIndex
CREATE INDEX "WarmupStats_userId_idx" ON "WarmupStats"("userId");

-- CreateIndex
CREATE INDEX "WarmupStats_instanceName_idx" ON "WarmupStats"("instanceName");

-- CreateIndex
CREATE INDEX "whatlead_campaigns_userId_idx" ON "whatlead_campaigns"("userId");

-- CreateIndex
CREATE INDEX "whatlead_campaigns_status_idx" ON "whatlead_campaigns"("status");

-- CreateIndex
CREATE INDEX "whatlead_campaign_messages_campaignId_idx" ON "whatlead_campaign_messages"("campaignId");

-- CreateIndex
CREATE INDEX "whatlead_campaign_leads_campaignId_idx" ON "whatlead_campaign_leads"("campaignId");

-- CreateIndex
CREATE INDEX "whatlead_campaign_leads_phone_idx" ON "whatlead_campaign_leads"("phone");

-- CreateIndex
CREATE INDEX "whatlead_campaign_leads_status_idx" ON "whatlead_campaign_leads"("status");

-- CreateIndex
CREATE UNIQUE INDEX "whatlead_campaign_leads_campaignId_phone_key" ON "whatlead_campaign_leads"("campaignId", "phone");

-- CreateIndex
CREATE INDEX "campaign_schedules_campaignId_idx" ON "campaign_schedules"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_schedules_instanceName_idx" ON "campaign_schedules"("instanceName");

-- CreateIndex
CREATE INDEX "campaign_schedules_scheduledDate_idx" ON "campaign_schedules"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "whatlead_campaign_statistics_campaignId_key" ON "whatlead_campaign_statistics"("campaignId");

-- CreateIndex
CREATE INDEX "whatlead_campaign_statistics_campaignId_idx" ON "whatlead_campaign_statistics"("campaignId");

-- CreateIndex
CREATE INDEX "MessageLog_campaignId_messageDate_idx" ON "MessageLog"("campaignId", "messageDate");

-- CreateIndex
CREATE INDEX "MessageLog_campaignLeadId_messageDate_idx" ON "MessageLog"("campaignLeadId", "messageDate");

-- CreateIndex
CREATE INDEX "MessageLog_status_idx" ON "MessageLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_messageId_messageDate_key" ON "MessageLog"("messageId", "messageDate");

-- CreateIndex
CREATE UNIQUE INDEX "MessageAnalytics_campaignId_date_key" ON "MessageAnalytics"("campaignId", "date");

-- AddForeignKey
ALTER TABLE "whatlead_users" ADD CONSTRAINT "whatlead_users_whatleadCompanyId_fkey" FOREIGN KEY ("whatleadCompanyId") REFERENCES "whatlead_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatleadparceiroconfigs" ADD CONSTRAINT "whatleadparceiroconfigs_whatleadCompanyId_fkey" FOREIGN KEY ("whatleadCompanyId") REFERENCES "whatlead_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatleadleads" ADD CONSTRAINT "whatleadleads_configid_fkey" FOREIGN KEY ("configid") REFERENCES "whatleadparceiroconfigs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "whatlead_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "whatlead_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaStats" ADD CONSTRAINT "MediaStats_instanceName_fkey" FOREIGN KEY ("instanceName") REFERENCES "Instance"("instanceName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_instanceName_fkey" FOREIGN KEY ("instanceName") REFERENCES "Instance"("instanceName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_mediaReceivedId_fkey" FOREIGN KEY ("mediaReceivedId") REFERENCES "MediaStats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_mediaStatsId_fkey" FOREIGN KEY ("mediaStatsId") REFERENCES "MediaStats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "whatlead_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatlead_campaigns" ADD CONSTRAINT "whatlead_campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "whatlead_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDispatch" ADD CONSTRAINT "CampaignDispatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatlead_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDispatch" ADD CONSTRAINT "CampaignDispatch_instanceName_fkey" FOREIGN KEY ("instanceName") REFERENCES "Instance"("instanceName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatlead_campaign_messages" ADD CONSTRAINT "whatlead_campaign_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatlead_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatlead_campaign_leads" ADD CONSTRAINT "whatlead_campaign_leads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "whatlead_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatlead_campaign_leads" ADD CONSTRAINT "whatlead_campaign_leads_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatlead_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatlead_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_instanceName_fkey" FOREIGN KEY ("instanceName") REFERENCES "Instance"("instanceName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatlead_campaign_statistics" ADD CONSTRAINT "whatlead_campaign_statistics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatlead_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatlead_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_campaignLeadId_fkey" FOREIGN KEY ("campaignLeadId") REFERENCES "whatlead_campaign_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "whatleadleads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAnalytics" ADD CONSTRAINT "MessageAnalytics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatlead_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignErrorLog" ADD CONSTRAINT "CampaignErrorLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatlead_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
