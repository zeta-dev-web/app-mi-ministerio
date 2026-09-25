-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "congregation" TEXT,
    "baptismDate" DATE,
    "publisherSince" DATE,
    "personalGoalHours" INTEGER,
    "serviceRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRole" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "monthlyQuota" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryType" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistryType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestedPerson" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "territory" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "age" INTEGER,
    "notes" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterestedPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "manualHours" INTEGER,
    "manualMinutes" INTEGER,
    "minutes" INTEGER NOT NULL,
    "ministryTypeId" TEXT NOT NULL,
    "didStudy" BOOLEAN NOT NULL DEFAULT false,
    "didVisit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryRecordPerson" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinistryRecordPerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRole_code_key" ON "ServiceRole"("code");

-- CreateIndex
CREATE INDEX "MinistryType_userId_active_idx" ON "MinistryType"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MinistryType_userId_name_key" ON "MinistryType"("userId", "name");

-- CreateIndex
CREATE INDEX "InterestedPerson_userId_status_idx" ON "InterestedPerson"("userId", "status");

-- CreateIndex
CREATE INDEX "InterestedPerson_userId_firstName_lastName_idx" ON "InterestedPerson"("userId", "firstName", "lastName");

-- CreateIndex
CREATE INDEX "MinistryRecord_userId_date_idx" ON "MinistryRecord"("userId", "date");

-- CreateIndex
CREATE INDEX "MinistryRecord_userId_ministryTypeId_idx" ON "MinistryRecord"("userId", "ministryTypeId");

-- CreateIndex
CREATE INDEX "MinistryRecordPerson_personId_idx" ON "MinistryRecordPerson"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "MinistryRecordPerson_recordId_personId_key" ON "MinistryRecordPerson"("recordId", "personId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_serviceRoleId_fkey" FOREIGN KEY ("serviceRoleId") REFERENCES "ServiceRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryType" ADD CONSTRAINT "MinistryType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestedPerson" ADD CONSTRAINT "InterestedPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryRecord" ADD CONSTRAINT "MinistryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryRecord" ADD CONSTRAINT "MinistryRecord_ministryTypeId_fkey" FOREIGN KEY ("ministryTypeId") REFERENCES "MinistryType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryRecordPerson" ADD CONSTRAINT "MinistryRecordPerson_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MinistryRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryRecordPerson" ADD CONSTRAINT "MinistryRecordPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "InterestedPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
