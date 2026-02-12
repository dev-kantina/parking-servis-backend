-- AlterTable
ALTER TABLE "standards" ALTER COLUMN "location" DROP NOT NULL;

-- AlterTable
ALTER TABLE "work_orders" ALTER COLUMN "location" DROP NOT NULL;
