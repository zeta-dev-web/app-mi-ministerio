-- AlterTable
ALTER TABLE "User" ADD COLUMN     "carryMinutes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "roundUp" BOOLEAN NOT NULL DEFAULT false;
