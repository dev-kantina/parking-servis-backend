-- CreateTable
CREATE TABLE "shift_intervals" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shift_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_intervals_shiftId_idx" ON "shift_intervals"("shiftId");

-- AddForeignKey
ALTER TABLE "shift_intervals" ADD CONSTRAINT "shift_intervals_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
