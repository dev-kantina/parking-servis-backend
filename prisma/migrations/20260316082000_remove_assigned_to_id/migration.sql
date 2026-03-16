-- DropIndex
DROP INDEX IF EXISTS "work_orders_assignedToId_idx";

-- AlterTable
ALTER TABLE "work_orders" DROP COLUMN "assignedToId";
