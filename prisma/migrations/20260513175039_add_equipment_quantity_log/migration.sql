-- CreateTable
CREATE TABLE "equipment_quantity_logs" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oldQuantity" INTEGER,
    "newQuantity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_quantity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_quantity_logs_equipmentId_idx" ON "equipment_quantity_logs"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_quantity_logs_userId_idx" ON "equipment_quantity_logs"("userId");

-- AddForeignKey
ALTER TABLE "equipment_quantity_logs" ADD CONSTRAINT "equipment_quantity_logs_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_quantity_logs" ADD CONSTRAINT "equipment_quantity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
