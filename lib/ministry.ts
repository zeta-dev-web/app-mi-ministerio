/** Helpers de dominio para el registro de actividad. */

export const QUARTER_STEPS = [0, 15, 30, 45] as const;

export function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Hora inválida: ${hhmm}`);
  }
  return h * 60 + m;
}

export function minutesToTimeString(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Redondea hacia abajo a múltiplo de 15 (la UI solo permite 0/15/30/45 en manual). */
export function roundDownToQuarter(total: number): number {
  return Math.floor(total / 15) * 15;
}

export type ComputedDuration =
  | { ok: true; minutes: number }
  | { ok: false; error: string };

/**
 * Calcula la duración final en minutos según las reglas confirmadas:
 * - Si hay carga manual (horas + minutos en pasos de 15) prevalece.
 * - Si no, se usa fin - inicio del mismo día (fin > inicio).
 */
export function computeRecordMinutes(input: {
  startMinute?: number | null;
  endMinute?: number | null;
  manualHours?: number | null;
  manualMinutes?: number | null;
}): ComputedDuration {
  const { startMinute, endMinute, manualHours, manualMinutes } = input;

  const hasManual =
    manualHours !== undefined &&
    manualHours !== null &&
    manualMinutes !== undefined &&
    manualMinutes !== null;

  if (hasManual) {
    if (!Number.isInteger(manualHours!) || manualHours! < 0 || manualHours! > 24) {
      return { ok: false, error: "Horas manuales inválidas (0-24)." };
    }
    if (!QUARTER_STEPS.includes(manualMinutes as (typeof QUARTER_STEPS)[number])) {
      return { ok: false, error: "Los minutos manuales deben ser 00, 15, 30 o 45." };
    }
    const total = manualHours! * 60 + manualMinutes!;
    if (total <= 0) return { ok: false, error: "La duración debe ser mayor a 0." };
    if (total > 24 * 60) return { ok: false, error: "La duración no puede superar 24 h." };
    return { ok: true, minutes: total };
  }

  if (startMinute == null || endMinute == null) {
    return { ok: false, error: "Indicá inicio y fin, o cargá las horas manualmente." };
  }
  if (startMinute < 0 || startMinute >= 24 * 60 || endMinute <= 0 || endMinute > 24 * 60) {
    return { ok: false, error: "Horario fuera del día (00:00-24:00)." };
  }
  if (endMinute <= startMinute) {
    return { ok: false, error: "La hora de fin debe ser posterior a la de inicio, dentro del mismo día." };
  }
  const diff = endMinute - startMinute;
  return { ok: true, minutes: roundDownToQuarter(diff) };
}
