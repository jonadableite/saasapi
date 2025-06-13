/*
  Warnings:

  - You are about to drop the column `evoAiClientId` on the `whatlead_users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "whatlead_users" DROP COLUMN "evoAiClientId",
ADD COLUMN     "client_Id" TEXT;
