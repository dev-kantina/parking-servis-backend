-- AlterTable
ALTER TABLE "standards" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "standard_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standard_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "standard_groups_name_key" ON "standard_groups"("name");

-- CreateIndex
CREATE INDEX "standard_groups_isActive_idx" ON "standard_groups"("isActive");

-- CreateIndex
CREATE INDEX "standards_groupId_idx" ON "standards"("groupId");

-- AddForeignKey
ALTER TABLE "standards" ADD CONSTRAINT "standards_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "standard_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
