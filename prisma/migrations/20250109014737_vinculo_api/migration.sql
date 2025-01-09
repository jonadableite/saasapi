/*
  Warnings:

  - The primary key for the `Instance` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `MediaStats` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Payment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `WarmupStats` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Instance" DROP CONSTRAINT "Instance_userId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";

-- DropForeignKey
ALTER TABLE "WarmupStats" DROP CONSTRAINT "WarmupStats_mediaReceivedId_fkey";

-- DropForeignKey
ALTER TABLE "WarmupStats" DROP CONSTRAINT "WarmupStats_mediaStatsId_fkey";

-- DropForeignKey
ALTER TABLE "WarmupStats" DROP CONSTRAINT "WarmupStats_userId_fkey";

-- AlterTable
ALTER TABLE "Instance" DROP CONSTRAINT "Instance_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Instance_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Instance_id_seq";

-- AlterTable
ALTER TABLE "MediaStats" DROP CONSTRAINT "MediaStats_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "MediaStats_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "MediaStats_id_seq";

-- AlterTable
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Payment_id_seq";

-- AlterTable
ALTER TABLE "WarmupStats" DROP CONSTRAINT "WarmupStats_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "mediaStatsId" SET DATA TYPE TEXT,
ALTER COLUMN "mediaReceivedId" SET DATA TYPE TEXT,
ADD CONSTRAINT "WarmupStats_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "WarmupStats_id_seq";

-- DropTable
DROP TABLE "User";

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
CREATE TABLE "bot_descritivo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "descritivo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_descritivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatlead_companies_createdAt_idx" ON "whatlead_companies"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "whatlead_users_email_profile_phone_createdAt_idx" ON "whatlead_users"("email", "profile", "phone", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "whatleadparceiroconfigs_campaignnumberbusiness_key" ON "whatleadparceiroconfigs"("campaignnumberbusiness");

-- CreateIndex
CREATE INDEX "whatleadleads_phone_configid_idx" ON "whatleadleads"("phone", "configid");

-- CreateIndex
CREATE INDEX "bot_descritivo_name_descritivo_createdAt_idx" ON "bot_descritivo"("name", "descritivo", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Instance_userId_idx" ON "Instance"("userId");

-- CreateIndex
CREATE INDEX "WarmupStats_userId_idx" ON "WarmupStats"("userId");

-- CreateIndex
CREATE INDEX "WarmupStats_instanceName_idx" ON "WarmupStats"("instanceName");

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
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_mediaStatsId_fkey" FOREIGN KEY ("mediaStatsId") REFERENCES "MediaStats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_mediaReceivedId_fkey" FOREIGN KEY ("mediaReceivedId") REFERENCES "MediaStats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupStats" ADD CONSTRAINT "WarmupStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "whatlead_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
