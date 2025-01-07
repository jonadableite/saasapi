-- AddForeignKey
ALTER TABLE "MediaStats" ADD CONSTRAINT "MediaStats_instanceName_fkey" FOREIGN KEY ("instanceName") REFERENCES "Instance"("instanceName") ON DELETE RESTRICT ON UPDATE CASCADE;
