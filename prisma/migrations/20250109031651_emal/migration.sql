/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `whatlead_users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "whatlead_users_email_key" ON "whatlead_users"("email");
