import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { chapterUrl, lastWeek, streak, suggestion } from "@/lib/bible";

export async function GET() {
  const { userId } = await requireUser();
  const [books, readings, user] = await Promise.all([
    db.bibleBook.findMany({ orderBy: { sortOrder: "asc" } }),
    db.bibleReading.findMany({ where: { userId } }),
    db.user.findUnique({ where: { id: userId }, select: { bibleSelectedBookId: true } }),
  ]);

  const readKeys = new Set(readings.map((r) => `${r.bookId}:${r.chapter}`));
  const byBook = new Map<string, number>();
  const chaptersByBook = new Map<string, number[]>();
  for (const r of readings) {
    byBook.set(r.bookId, (byBook.get(r.bookId) ?? 0) + 1);
    const arr = chaptersByBook.get(r.bookId) ?? [];
    arr.push(r.chapter);
    chaptersByBook.set(r.bookId, arr);
  }

  const totalChapters = books.reduce((a, b) => a + b.chapters, 0);
  const hebrewBooks = books.filter((b) => b.testament === "HEBREW");
  const greekBooks = books.filter((b) => b.testament === "GREEK");
  const hebrewTotal = hebrewBooks.reduce((a, b) => a + b.chapters, 0);
  const greekTotal = greekBooks.reduce((a, b) => a + b.chapters, 0);
  const hebrewRead = hebrewBooks.reduce((a, b) => a + (byBook.get(b.id) ?? 0), 0);
  const greekRead = greekBooks.reduce((a, b) => a + (byBook.get(b.id) ?? 0), 0);

  const now = new Date();
  const readAts = readings.map((r) => r.readAt);
  const next = suggestion(books, readKeys);
  const selectedBook = books.find((book) => book.id === user?.bibleSelectedBookId)
    ?? books.find((book) => book.name === "Génesis" || book.name === "Genesis")
    ?? books[0]
    ?? null;
  const selectedReadChapters = selectedBook ? (chaptersByBook.get(selectedBook.id) ?? []) : [];
  const selectedNextChapter = selectedBook
    ? Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).find((chapter) => !selectedReadChapters.includes(chapter)) ?? null
    : null;

  return NextResponse.json({
    total: { read: readings.length, chapters: totalChapters },
    hebrew: { read: hebrewRead, chapters: hebrewTotal },
    greek: { read: greekRead, chapters: greekTotal },
    streak: streak(readAts, now),
    week: lastWeek(readAts, now),
    suggestion: next
      ? {
          bookId: next.book.id,
          bookName: next.book.name,
          chapter: next.chapter,
          url: chapterUrl(next.book.sortOrder + 1, next.chapter),
        }
      : null,
    personal: selectedBook
      ? {
          selectedBookId: selectedBook.id,
          bookId: selectedBook.id,
          bookName: selectedBook.name,
          chapters: selectedBook.chapters,
          read: selectedReadChapters.length,
          nextChapter: selectedNextChapter,
          url: selectedNextChapter ? chapterUrl(selectedBook.sortOrder + 1, selectedNextChapter) : null,
        }
      : null,
    books: books.map((b) => ({
      id: b.id,
      name: b.name,
      testament: b.testament,
      chapters: b.chapters,
      read: byBook.get(b.id) ?? 0,
      readChapters: chaptersByBook.get(b.id) ?? [],
      bookNumber: b.sortOrder + 1,
    })),
  });
}

const toggleSchema = z.object({
  bookId: z.string().min(1),
  chapter: z.number().int().min(1),
});

const selectSchema = z.object({ action: z.literal("select"), bookId: z.string().min(1) });

export async function POST(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const selection = selectSchema.safeParse(body);
  if (selection.success) {
    const book = await db.bibleBook.findUnique({ where: { id: selection.data.bookId } });
    if (!book) return NextResponse.json({ error: "Libro inválido." }, { status: 400 });
    await db.user.update({ where: { id: userId }, data: { bibleSelectedBookId: book.id } });
    return NextResponse.json({ selectedBookId: book.id });
  }

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const { bookId, chapter } = parsed.data;
  const book = await db.bibleBook.findUnique({ where: { id: bookId } });
  if (!book || chapter > book.chapters) {
    return NextResponse.json({ error: "Capítulo inválido." }, { status: 400 });
  }

  await db.user.updateMany({
    where: { id: userId, bibleSelectedBookId: null },
    data: { bibleSelectedBookId: book.id },
  });

  const existing = await db.bibleReading.findUnique({
    where: { userId_bookId_chapter: { userId, bookId, chapter } },
  });
  if (existing) {
    await db.bibleReading.delete({ where: { id: existing.id } });
    return NextResponse.json({ read: false });
  }
  const today = new Date().toISOString().slice(0, 10);
  await db.bibleReading.create({
    data: { userId, bookId, chapter, readAt: new Date(today + "T12:00:00.000Z") },
  });
  return NextResponse.json({ read: true }, { status: 201 });
}
