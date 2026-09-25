-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timerAccumulatedSec" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timerStartedAt" TIMESTAMP(3);
