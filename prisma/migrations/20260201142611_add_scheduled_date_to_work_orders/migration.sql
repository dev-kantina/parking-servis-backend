-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "scheduledDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "work_orders_scheduledDate_idx" ON "work_orders"("scheduledDate");
