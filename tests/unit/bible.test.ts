// Tests unitarios de racha y sugerencia de lectura (lib/bible.ts, FASE 5).
// Reloj congelado: nunca se usa la hora real.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streak, suggestion, type BookInfo } from "@/lib/bible";

const NOW = new Date("2026-09-25T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const BOOKS: BookInfo[] = [
  { id: "gen", name: "Génesis", testament: "AT", chapters: 2, sortOrder: 1 },
  { id: "exo", name: "Éxodo", testament: "AT", chapters: 3, sortOrder: 2 },
];

describe("streak", () => {
  it("cuenta días consecutivos incluyendo hoy", () => {
    const reads = [
      new Date("2026-09-25T08:00:00.000Z"),
      new Date("2026-09-24T08:00:00.000Z"),
      new Date("2026-09-23T08:00:00.000Z"),
    ];
    expect(streak(reads, NOW)).toBe(3);
  });

  it("si hoy aún no se leyó, cuenta desde ayer; el hueco corta la racha", () => {
    const reads = [
      new Date("2026-09-24T08:00:00.000Z"),
      new Date("2026-09-23T08:00:00.000Z"),
      new Date("2026-09-21T08:00:00.000Z"), // hueco el 22
    ];
    expect(streak(reads, NOW)).toBe(2);
    expect(streak([], NOW)).toBe(0);
  });
});

describe("suggestion", () => {
  it("devuelve el primer capítulo no leído en orden canónico", () => {
    const read = new Set(["gen:1", "gen:2"]);
    const s = suggestion(BOOKS, read);
    expect(s).toEqual({ book: BOOKS[1], chapter: 1 });
  });

  it("null si todo está leído; primer capítulo si nada está leído", () => {
    const all = new Set(["gen:1", "gen:2", "exo:1", "exo:2", "exo:3"]);
    expect(suggestion(BOOKS, all)).toBeNull();
    expect(suggestion(BOOKS, new Set())).toEqual({ book: BOOKS[0], chapter: 1 });
  });
});
