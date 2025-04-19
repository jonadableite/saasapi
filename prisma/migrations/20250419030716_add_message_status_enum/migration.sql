/*
  Warnings:

  - The `connectionStatus` column on the `Instance` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Message` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'OFFLINE', 'ERROR');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterTable
ALTER TABLE "Instance" DROP COLUMN "connectionStatus",
ADD COLUMN     "connectionStatus" "InstanceStatus" NOT NULL DEFAULT 'DISCONNECTED';

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "status",
ADD COLUMN     "status" "MessageStatus" NOT NULL DEFAULT 'PENDING';
