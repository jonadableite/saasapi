-- AlterTable
ALTER TABLE "whatlead_users" ADD COLUMN     "referredBy" TEXT;

-- AddForeignKey
ALTER TABLE "whatlead_users" ADD CONSTRAINT "whatlead_users_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "whatlead_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
