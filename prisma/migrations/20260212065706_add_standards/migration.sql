/*
  Warnings:

  - You are about to drop the `time_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('DAILY', 'WEEKLY');

-- DropForeignKey
ALTER TABLE "time_logs" DROP CONSTRAINT "time_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "time_logs" DROP CONSTRAINT "time_logs_workOrderId_fkey";

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "standardId" TEXT;

-- DropTable
DROP TABLE "time_logs";

-- CreateTable
CREATE TABLE "standards" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'MEDIUM',
    "recurrenceType" "RecurrenceType" NOT NULL,
    "daysOfWeek" "DayOfWeek"[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "defaultAssignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standards_isActive_idx" ON "standards"("isActive");

-- CreateIndex
CREATE INDEX "work_orders_standardId_idx" ON "work_orders"("standardId");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "standards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standards" ADD CONSTRAINT "standards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standards" ADD CONSTRAINT "standards_defaultAssignedToId_fkey" FOREIGN KEY ("defaultAssignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
