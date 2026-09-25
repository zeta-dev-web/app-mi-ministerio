-- CreateEnum
CREATE TYPE "Testament" AS ENUM ('HEBREW', 'GREEK');

-- CreateTable
CREATE TABLE "BibleBook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "testament" "Testament" NOT NULL,
    "chapters" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BibleBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BibleReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "readAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BibleReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BibleBook_name_key" ON "BibleBook"("name");

-- CreateIndex
CREATE INDEX "BibleReading_userId_readAt_idx" ON "BibleReading"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "BibleReading_userId_bookId_chapter_key" ON "BibleReading"("userId", "bookId", "chapter");

-- AddForeignKey
ALTER TABLE "BibleReading" ADD CONSTRAINT "BibleReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BibleReading" ADD CONSTRAINT "BibleReading_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "BibleBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
