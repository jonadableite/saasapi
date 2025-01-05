-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" BOOLEAN NOT NULL DEFAULT true,
    "maxInstances" INTEGER NOT NULL DEFAULT 2,
    "trialEndDate" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeSubscriptionStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" SERIAL NOT NULL,
    "instanceName" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL DEFAULT 'pending',
    "number" TEXT,
    "ownerJid" TEXT,
    "profilePicUrl" TEXT,
    "integration" TEXT NOT NULL DEFAULT 'WHATSAPP-BAILEYS',
    "token" TEXT,
    "clientName" TEXT,
    "profileName" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disconnectedAt" TIMESTAMP(3),
    "disconnectionObject" JSONB,
    "disconnectionReasonCode" TEXT,
    "typebot" JSONB,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaStats" (
    "id" SERIAL NOT NULL,
    "instanceName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "text" INTEGER NOT NULL DEFAULT 0,
    "image" INTEGER NOT NULL DEFAULT 0,
    "video" INTEGER NOT NULL DEFAULT 0,
    "audio" INTEGER NOT NULL DEFAULT 0,
    "sticker" INTEGER NOT NULL DEFAULT 0,
    "reaction" INTEGER NOT NULL DEFAULT 0,
    "totalDaily" INTEGER NOT NULL DEFAULT 0,
    "totalAllTime" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarmupStats" (
    "id" SERIAL NOT NULL,
    "instanceName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paused',
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesReceived" INTEGER NOT NULL DEFAULT 0,
    "warmupTime" INTEGER NOT NULL DEFAULT 0,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startTime" TIMESTAMP(3),
    "pauseTime" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mediaStatsId" INTEGER,
    "mediaReceivedId" INTEGER,

    CONSTRAINT "WarmupStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_instanceName_key" ON "Instance"("instanceName");

-- CreateIndex
CREATE UNIQUE INDEX "WarmupStats_instanceName_key" ON "WarmupStats"("instanceName");

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_mediaStatsId_fkey" FOREIGN KEY ("mediaStatsId") REFERENCES "MediaStats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_mediaReceivedId_fkey" FOREIGN KEY ("mediaReceivedId") REFERENCES "MediaStats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_instanceName_fkey" FOREIGN KEY ("instanceName") REFERENCES "Instance"("instanceName") ON DELETE RESTRICT ON UPDATE CASCADE;
