-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'PARTIAL', 'FAILED', 'CANCELLED', 'EXPIRED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'GONE');

-- DropIndex
DROP INDEX "User_bibleSelectedBookId_idx";

-- AlterTable
ALTER TABLE "MinistryTask" ADD COLUMN     "reminderTimeZone" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timeZone" TEXT;

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "timeZone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskNotificationJob" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskNotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushNotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "errorCode" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_active_idx" ON "PushSubscription"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TaskNotificationJob_taskId_key" ON "TaskNotificationJob"("taskId");

-- CreateIndex
CREATE INDEX "TaskNotificationJob_status_nextAttemptAt_idx" ON "TaskNotificationJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "TaskNotificationJob_userId_idx" ON "TaskNotificationJob"("userId");

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_subscriptionId_idx" ON "PushNotificationDelivery"("subscriptionId");

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_status_lastAttemptAt_idx" ON "PushNotificationDelivery"("status", "lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushNotificationDelivery_notificationId_subscriptionId_revi_key" ON "PushNotificationDelivery"("notificationId", "subscriptionId", "revision");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNotificationJob" ADD CONSTRAINT "TaskNotificationJob_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MinistryTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNotificationJob" ADD CONSTRAINT "TaskNotificationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationDelivery" ADD CONSTRAINT "PushNotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "TaskNotificationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationDelivery" ADD CONSTRAINT "PushNotificationDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índice parcial para el barrido del worker (§7.5): solo trabajos reclamables.
CREATE INDEX "TaskNotificationJob_due_idx"
ON "TaskNotificationJob" ("nextAttemptAt")
WHERE "status" IN ('PENDING', 'FAILED');
