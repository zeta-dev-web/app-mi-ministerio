/** Lógica pura de lectura bíblica: racha y pasaje sugerido. */

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

/** Días distintos con lectura, ordenados. */
export function distinctDays(readAts: Date[]): string[] {
  return [...new Set(readAts.map(dayKey))].sort();
}

/**
 * URL verificada al capítulo en la Biblioteca en línea (abre el capítulo exacto;
 * en el celular el sistema puede ofrecer abrirlo con JWB Library).
 * bookNumber: 1-66 en orden canónico.
 */
export function chapterUrl(bookNumber: number, chapter: number): string {
  return `https://wol.jw.org/es/wol/b/r4/lp-s/nwt/${bookNumber}/${chapter}`;
}

/**
 * Racha de días consecutivos con lectura.
 * Cuenta hacia atrás desde hoy (o desde ayer si hoy aún no se leyó).
 */
export function streak(readAts: Date[], now: Date): number {
  const days = new Set(distinctDays(readAts));
  const today = dayKey(now);
  let cursor = days.has(today) ? 0 : -1;
  let count = 0;
  while (days.has(dayKey(shiftDays(now, cursor)))) {
    count++;
    cursor--;
  }
  return count;
}

/** Actividad de los últimos 7 días (incluye hoy), con etiqueta de día. */
export function lastWeek(readAts: Date[], now: Date): { key: string; label: string; active: boolean; isToday: boolean }[] {
  const days = new Set(distinctDays(readAts));
  const initials = ["d", "l", "m", "m", "j", "v", "s"]; // getUTCDay 0=domingo
  return Array.from({ length: 7 }, (_, i) => {
    const d = shiftDays(now, i - 6);
    const key = dayKey(d);
    return {
      key,
      label: initials[d.getUTCDay()],
      active: days.has(key),
      isToday: i === 6,
    };
  });
}

export type BookInfo = { id: string; name: string; testament: string; chapters: number; sortOrder: number };

/** Primer capítulo no leído en orden canónico, o null si se completó todo. */
export function suggestion(
  books: BookInfo[],
  readKeys: Set<string> // `${bookId}:${chapter}`
): { book: BookInfo; chapter: number } | null {
  const ordered = [...books].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const book of ordered) {
    for (let c = 1; c <= book.chapters; c++) {
      if (!readKeys.has(`${book.id}:${c}`)) return { book, chapter: c };
    }
  }
  return null;
}
