/*
  Warnings:

  - Added the required column `userId` to the `whatlead_campaign_leads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "whatlead_campaign_leads" ADD COLUMN "userId" TEXT;

 Atualize os registros existentes com um userId padrão
-- Substitua 'default-user-id' pelo ID de um usuário real do seu sistema
UPDATE "whatlead_campaign_leads" SET "userId" = 'default-user-id' WHERE "userId" IS NULL;

-- Agora torne a coluna NOT NULL
ALTER TABLE "whatlead_campaign_leads" ALTER COLUMN "userId" SET NOT NULL;

-- Adicione a foreign key
ALTER TABLE "whatlead_campaign_leads" ADD CONSTRAINT "whatlead_campaign_leads_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "whatlead_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
