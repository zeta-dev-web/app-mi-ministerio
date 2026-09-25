-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'DONE');

-- CreateTable
CREATE TABLE "MinistryTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "topic" TEXT,
    "date" DATE NOT NULL,
    "timeMinute" INTEGER,
    "notes" TEXT,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderMinutesBefore" INTEGER,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistryTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinistryTask_userId_status_date_idx" ON "MinistryTask"("userId", "status", "date");

-- AddForeignKey
ALTER TABLE "MinistryTask" ADD CONSTRAINT "MinistryTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
