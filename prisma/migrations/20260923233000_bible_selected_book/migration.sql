ALTER TABLE "User" ADD COLUMN "bibleSelectedBookId" TEXT;

CREATE INDEX "User_bibleSelectedBookId_idx" ON "User"("bibleSelectedBookId");

ALTER TABLE "User" ADD CONSTRAINT "User_bibleSelectedBookId_fkey" FOREIGN KEY ("bibleSelectedBookId") REFERENCES "BibleBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;
