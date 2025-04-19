-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "lastMessage" TEXT,
ADD COLUMN     "unreadCount" INTEGER NOT NULL DEFAULT 0;
