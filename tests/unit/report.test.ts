// Tests unitarios de reportedHours / redondeo (lib/report.ts, FASE 5 §22.1).
import { describe, expect, it } from "vitest";
import { monthLeftover, reportedHours } from "@/lib/report";

describe("reportedHours", () => {
  it("sin carry redondea hacia arriba (roundUp)", () => {
    // 61 min → 2 h reportadas, sobran 1.
    expect(reportedHours(61, 0, false)).toEqual({ reportedHours: 2, leftover: 1 });
    // Hora exacta no redondea de más.
    expect(reportedHours(120, 0, false)).toEqual({ reportedHours: 2, leftover: 0 });
  });

  it("con carry informa hacia abajo sumando el arrastre anterior", () => {
    // 61 min = 60 + 1; +59 de arrastre = 119 → 1 h hacia abajo (sobra 1).
    expect(reportedHours(61, 59, true)).toEqual({ reportedHours: 1, leftover: 1 });
    // Con carry: 150 min = 120 + 30 de sobra; +30 de arrastre = 150 → 2 h
    // hacia abajo (sin carry serían ceil(150/60) = 3).
    expect(reportedHours(150, 30, true)).toEqual({ reportedHours: 2, leftover: 30 });
    // Sin carry esos mismos 90 min redondearían hacia arriba igual a 2.
    expect(reportedHours(90, 0, false)).toEqual({ reportedHours: 2, leftover: 30 });
  });

  it("base 0 → 0 horas (sin y con carry)", () => {
    expect(reportedHours(0, 0, false)).toEqual({ reportedHours: 0, leftover: 0 });
    expect(reportedHours(0, 45, true)).toEqual({ reportedHours: 0, leftover: 0 });
    // Minutos solos sin completar hora y sin arrastre útil → 0 con carry.
    expect(reportedHours(30, 0, true)).toEqual({ reportedHours: 0, leftover: 30 });
  });

  it("monthLeftover es el resto no reportable", () => {
    expect(monthLeftover(125)).toBe(5);
    expect(monthLeftover(120)).toBe(0);
  });
});
