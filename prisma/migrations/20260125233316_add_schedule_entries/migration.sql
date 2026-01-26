-- CreateTable
CREATE TABLE "schedule_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_entries_userId_idx" ON "schedule_entries"("userId");

-- CreateIndex
CREATE INDEX "schedule_entries_shiftId_idx" ON "schedule_entries"("shiftId");

-- CreateIndex
CREATE INDEX "schedule_entries_date_idx" ON "schedule_entries"("date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_entries_userId_date_key" ON "schedule_entries"("userId", "date");

-- AddForeignKey
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
