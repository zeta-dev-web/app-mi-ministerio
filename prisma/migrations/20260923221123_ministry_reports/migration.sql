-- AlterTable
ALTER TABLE "User" ADD COLUMN     "recipientName" TEXT,
ADD COLUMN     "recipientPhone" TEXT;

-- CreateTable
CREATE TABLE "MinistryReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistryReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinistryReport_userId_idx" ON "MinistryReport"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MinistryReport_userId_month_key" ON "MinistryReport"("userId", "month");

-- AddForeignKey
ALTER TABLE "MinistryReport" ADD CONSTRAINT "MinistryReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
