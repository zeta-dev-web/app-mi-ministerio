-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledMinistryTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ministryTypesConfigured" BOOLEAN NOT NULL DEFAULT false;
