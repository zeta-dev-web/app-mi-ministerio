"use client";

import { useCallback, useEffect, useState } from "react";
import { chapterUrl } from "@/lib/bible";

type BookProgress = {
  id: string;
  name: string;
  testament: "HEBREW" | "GREEK";
  chapters: number;
  read: number;
  readChapters: number[];
  bookNumber: number;
};

type Summary = {
  streak: number;
  week: { key: string; label: string; active: boolean; isToday: boolean }[];
  personal: {
    selectedBookId: string;
    bookId: string;
    bookName: string;
    chapters: number;
    read: number;
    nextChapter: number | null;
    url: string | null;
  } | null;
  books: BookProgress[];
};

function pct(read: number, total: number): string {
  if (total === 0) return "0%";
  const p = (read / total) * 100;
  return `${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%`;
}

export function BibliaClient() {
  const [data, setData] = useState<Summary | null>(null);
  const [openTestament, setOpenTestament] = useState<"HEBREW" | "GREEK" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/bible");
    const json = await res.json().catch(() => null);
    if (json && json.books) setData(json);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/bible", { signal: controller.signal })
      .then(res => res.json())
      .then(json => { if (json?.books) setData(json); })
      .catch(() => { /* The existing loading state remains available for retry. */ });
    return () => controller.abort();
  }, []);

  function isRead(book: BookProgress, chapter: number): boolean {
    return book.readChapters.includes(chapter);
  }

  async function toggle(bookId: string, chapter: number) {
    setBusy(true);
    const res = await fetch("/api/bible", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, chapter }),
    });
    setBusy(false);
    if (!res.ok) return;
    load();
  }

  async function selectBook(bookId: string) {
    setBusy(true);
    const res = await fetch("/api/bible", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "select", bookId }),
    });
    setBusy(false);
    if (res.ok) load();
  }

  if (!data) {
    return <p className="py-10 text-center text-sm text-muted">Cargando…</p>;
  }

  const hebrewBooks = data.books.filter((b) => b.testament === "HEBREW");
  const greekBooks = data.books.filter((b) => b.testament === "GREEK");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-fluid-3xl text-balance tracking-tight">Lectura de la Biblia</h1>

      <section aria-label="Racha de lectura" className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-muted">{data.streak === 0 ? "Sin Racha" : "Racha"}</p>
          <p className="font-display text-2xl tabular-nums">
            {data.streak} {data.streak === 1 ? "día" : "días"}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="list" aria-label="Últimos 7 días">
          {data.week.map((d) => (
            <div key={d.key} role="listitem" className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted">{d.label}</span>
              <span
                aria-label={`${d.key}: ${d.active ? "leído" : "no leído"}`}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium tabular-nums ${
                  d.active
                    ? "bg-primary text-on-primary"
                    : d.isToday
                      ? "border border-primary text-primary"
                      : "text-pale-red-ink"
                }`}
              >
                {d.active ? "✓" : d.isToday ? d.key.slice(8) : "✕"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {data.personal && (
        <section aria-label="Lectura de la Biblia personal" className="rounded-xl border border-line bg-surface p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-2xl tracking-tight">Lectura de la Biblia personal</h2>
              <p className="mt-1 text-sm text-muted">Elegí un libro y avanzá capítulo por capítulo.</p>
            </div>
            <label className="text-sm text-muted">
              <span className="sr-only">Libro seleccionado</span>
              <select
                value={data.personal.selectedBookId}
                disabled={busy}
                onChange={(event) => selectBook(event.target.value)}
                className="min-h-[44px] w-full rounded-md border border-line bg-canvas px-3 text-ink sm:w-auto"
              >
                {data.books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 rounded-lg bg-primary-soft p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-primary-ink">{data.personal.bookName}</span>
              <span className="text-sm text-primary-ink tabular-nums">{data.personal.read} / {data.personal.chapters}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuenow={Math.round((data.personal.read / data.personal.chapters) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso de ${data.personal.bookName}`}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${(data.personal.read / data.personal.chapters) * 100}%` }} />
            </div>
          </div>
          {data.personal.nextChapter ? (
            <>
              <p className="mt-4 text-lg font-medium">Capítulo {data.personal.nextChapter}</p>
              <p className="text-sm text-muted">Esta lectura queda pendiente hasta que la marques como leída.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={data.personal.url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex min-h-[48px] items-center justify-center rounded-md border border-primary px-4 font-medium text-primary transition-transform active:scale-[0.98]">Leer</a>
                <button type="button" disabled={busy} onClick={() => toggle(data.personal!.bookId, data.personal!.nextChapter!)} className="flex min-h-[48px] items-center justify-center rounded-md bg-primary px-4 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60">✓ Leído</button>
              </div>
            </>
          ) : (
            <p className="mt-4 rounded-md bg-primary-soft p-3 text-sm font-medium text-primary-ink">Completaste este libro. Podés elegir otro cuando quieras.</p>
          )}
        </section>
      )}

      <BookSection
        title="Escrituras Hebreoarameas"
        books={hebrewBooks}
        open={openTestament === "HEBREW"}
        onToggleSection={() => {
          setOpenTestament(openTestament === "HEBREW" ? null : "HEBREW");
          setExpanded(null);
        }}
        expanded={expanded}
        setExpanded={setExpanded}
        onToggle={toggle}
        busy={busy}
        isRead={isRead}
      />
      <BookSection
        title="Escrituras Griegas Cristianas"
        books={greekBooks}
        open={openTestament === "GREEK"}
        onToggleSection={() => {
          setOpenTestament(openTestament === "GREEK" ? null : "GREEK");
          setExpanded(null);
        }}
        expanded={expanded}
        setExpanded={setExpanded}
        onToggle={toggle}
        busy={busy}
        isRead={isRead}
      />
    </div>
  );
}

function BookSection({
  title,
  books,
  open,
  onToggleSection,
  expanded,
  setExpanded,
  onToggle,
  busy,
  isRead,
}: {
  title: string;
  books: BookProgress[];
  open: boolean;
  onToggleSection: () => void;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  onToggle: (bookId: string, chapter: number, currentlyRead: boolean) => void;
  busy: boolean;
  isRead: (book: BookProgress, chapter: number) => boolean;
}) {
  const read = books.reduce((a, b) => a + b.read, 0);
  const total = books.reduce((a, b) => a + b.chapters, 0);
  return (
    <section aria-label={title} className="overflow-hidden rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={onToggleSection}
        aria-expanded={open}
        className="flex min-h-[64px] w-full items-center justify-between gap-2 p-4 text-left transition-transform active:scale-[0.99] sm:px-6"
      >
        <span className="font-display text-2xl tracking-tight">{title}</span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary-ink tabular-nums">
            {pct(read, total)}
          </span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 p-4 pt-0 sm:grid-cols-3 sm:px-6 sm:pb-6">
        {books.map((b, i) => {
          const isOpen = expanded === b.id;
          return (
            <div key={b.id} className={isOpen ? "col-span-2" : ""}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : b.id)}
                aria-expanded={isOpen}
                className="reveal flex w-full flex-col gap-1 rounded-xl border border-line bg-surface p-3 text-left transition-transform active:scale-[0.99]"
                style={{ "--index": Math.min(i, 6) } as React.CSSProperties}
              >
                <span className="font-medium">{b.name}</span>
                <span className="flex justify-between text-sm text-muted tabular-nums">
                  <span>{b.read}/{b.chapters}</span>
                  <span>{pct(b.read, b.chapters)}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(b.read / b.chapters) * 100}%` }} />
                </span>
              </button>
              {isOpen && (
                <div className="mt-2 rounded-xl border border-line bg-surface p-3">
                  {(() => {
                    const next = Array.from({ length: b.chapters }, (_, c) => c + 1).find((c) => !isRead(b, c));
                    return next != null ? (
                      <a
                        href={chapterUrl(b.bookNumber, next)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-primary text-sm font-medium text-primary transition-transform active:scale-[0.98]"
                      >
                        Leer {b.name} {next} en JWB Library
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <path d="M15 3h6v6M10 14L21 3" />
                        </svg>
                      </a>
                    ) : null;
                  })()}
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: b.chapters }, (_, c) => c + 1).map((c) => {
                      const on = isRead(b, c);
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={busy}
                          onClick={() => onToggle(b.id, c, on)}
                          aria-pressed={on}
                          aria-label={`${b.name} capítulo ${c}${on ? ", leído" : ""}`}
                          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-sm tabular-nums transition-transform active:scale-95 disabled:opacity-60 ${
                            on ? "bg-primary font-medium text-on-primary" : "border border-line"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Tocá un capítulo para marcarlo o desmarcarlo como leído.
                  </p>
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}
    </section>
  );
}
