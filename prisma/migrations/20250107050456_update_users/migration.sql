-- AlterTable
ALTER TABLE "User" ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "messagesPerDay" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "support" TEXT NOT NULL DEFAULT 'basic';
