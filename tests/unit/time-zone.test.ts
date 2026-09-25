// Tests unitarios de zona horaria (FASE 5, §22.1 del plan).
// Reloj congelado: nunca se usa la hora real.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertValidTimeZone,
  taskDateTimeToUtc,
} from "@/lib/notifications/time-zone";
import {
  computeReminderInstant,
  ReminderNotFutureError,
  ReminderValidationError,
} from "@/lib/notifications/schedule-task-reminder";

const FROZEN_NOW = new Date("2026-09-20T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function baseTask(overrides = {}) {
  return {
    id: "task-1",
    userId: "user-1",
    date: new Date("2026-09-25T00:00:00.000Z"),
    timeMinute: 600, // 10:00
    reminderEnabled: true,
    reminderMinutesBefore: 60,
    reminderAt: null,
    reminderTimeZone: "America/Argentina/Buenos_Aires",
    status: "PENDING" as const,
    ...overrides,
  };
}

describe("taskDateTimeToUtc", () => {
  it("BA 10:00 → 13:00Z (UTC-3 todo el año)", () => {
    const r = taskDateTimeToUtc(
      "2026-09-25",
      600,
      "America/Argentina/Buenos_Aires"
    );
    expect(r.toISOString()).toBe("2026-09-25T13:00:00.000Z");
  });

  it("UTC 10:00 → 10:00Z", () => {
    const r = taskDateTimeToUtc("2026-09-25", 600, "UTC");
    expect(r.toISOString()).toBe("2026-09-25T10:00:00.000Z");
  });

  it("rechaza abreviaturas (ART) y zonas inexistentes", () => {
    expect(() => assertValidTimeZone("ART")).toThrow(/inválida/i);
    expect(() => assertValidTimeZone("EST")).toThrow(/inválida/i);
    expect(() => assertValidTimeZone("GMT-3")).toThrow(/inválida/i);
    expect(() => assertValidTimeZone("Mars/Olympus")).toThrow(/inválida/i);
    expect(() =>
      taskDateTimeToUtc("2026-09-25", 600, "ART")
    ).toThrow(/inválida/i);
  });

  it("rechaza hora inexistente por DST (Santiago 2026-09-06 00:30, salto adelante)", () => {
    // Verificado contra ICU del servidor: el 2026-09-06 CL adelanta 00:00→01:00.
    expect(() => taskDateTimeToUtc("2026-09-06", 30, "America/Santiago")).toThrow(
      /no existe/i
    );
    // La hora siguiente al salto sí existe (01:30 → 04:30Z, ya en UTC-3).
    expect(
      taskDateTimeToUtc("2026-09-06", 90, "America/Santiago").toISOString()
    ).toBe("2026-09-06T04:30:00.000Z");
  });

  it("rechaza hora ambigua por DST (Santiago 2026-04-04 23:30, ocurre dos veces)", () => {
    // Verificado contra ICU: el 2026-04-04 CL atrasa y las 23:xx ocurren dos veces.
    expect(() =>
      taskDateTimeToUtc("2026-04-04", 1410, "America/Santiago")
    ).toThrow(/ambigua/i);
    // Una hora fuera del tramo repetido funciona.
    expect(
      taskDateTimeToUtc("2026-04-04", 1350, "America/Santiago").toISOString()
    ).toBe("2026-04-05T01:30:00.000Z");
  });
});

describe("computeReminderInstant", () => {
  it("resta la anticipación y cruza día/mes (01-10 00:15 BA −1440min → 30-09 03:15Z)", () => {
    const task = baseTask({
      date: new Date("2026-10-01T00:00:00.000Z"),
      timeMinute: 15,
      reminderMinutesBefore: 1440,
    });
    const d = computeReminderInstant(task, null, FROZEN_NOW);
    expect("scheduledFor" in d).toBe(true);
    if ("scheduledFor" in d) {
      // 00:15 BA = 03:15Z; −24h = 03:15Z del día/mes anterior.
      expect(d.scheduledFor.toISOString()).toBe("2026-09-30T03:15:00.000Z");
    }
  });

  it("rechaza relativo sin hora concreta (no inventa hora)", () => {
    const task = baseTask({ timeMinute: null });
    expect(() => computeReminderInstant(task, null, FROZEN_NOW)).toThrow(
      ReminderValidationError
    );
    expect(() => computeReminderInstant(task, null, FROZEN_NOW)).toThrow(
      /hora/i
    );
  });

  it("rechaza anticipación fuera de {15,30,60,120,1440}", () => {
    const task = baseTask({ reminderMinutesBefore: 45 });
    expect(() => computeReminderInstant(task, null, FROZEN_NOW)).toThrow(
      /anticipación inválida/i
    );
  });

  it("personalizado futuro válido → instante tal cual", () => {
    const at = new Date("2026-09-21T15:00:00.000Z");
    const task = baseTask({
      reminderMinutesBefore: null,
      reminderAt: at,
    });
    const d = computeReminderInstant(task, null, FROZEN_NOW);
    expect(d).toEqual({ scheduledFor: at });
  });

  it("personalizado pasado → ReminderNotFutureError; inválido → ValidationError", () => {
    const past = baseTask({
      reminderMinutesBefore: null,
      reminderAt: new Date("2026-09-19T15:00:00.000Z"),
    });
    expect(() => computeReminderInstant(past, null, FROZEN_NOW)).toThrow(
      ReminderNotFutureError
    );
    const invalid = baseTask({
      reminderMinutesBefore: null,
      reminderAt: new Date("no-fecha"),
    });
    expect(() => computeReminderInstant(invalid, null, FROZEN_NOW)).toThrow(
      ReminderValidationError
    );
  });

  it("DONE o deshabilitado → cancelación (no programa)", () => {
    expect(
      computeReminderInstant(baseTask({ status: "DONE" }), null, FROZEN_NOW)
    ).toEqual({ cancel: "completed" });
    expect(
      computeReminderInstant(baseTask({ reminderEnabled: false }), null, FROZEN_NOW)
    ).toEqual({ cancel: "disabled" });
  });
});
