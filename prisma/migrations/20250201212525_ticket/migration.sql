-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "chatFlowId" TEXT,
    "status" TEXT NOT NULL,
    "isGroup" BOOLEAN NOT NULL,
    "answered" BOOLEAN NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botRetries" INTEGER NOT NULL DEFAULT 0,
    "campaignId" TEXT,
    "tenantId" TEXT NOT NULL,
    "unreadMessages" INTEGER NOT NULL DEFAULT 0,
    "queueId" TEXT,
    "lastInteractionBot" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);
