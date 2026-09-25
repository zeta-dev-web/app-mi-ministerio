// Zona horaria para recordatorios (FASE 3, §§6/14 del plan).
//
// - Reutiliza la regla estricta de `lib/validations/push.ts` (forma
//   Área/Localidad + "UTC" exacta + construcción real con Intl; guarda la
//   forma canónica). No se aceptan abreviaturas (ART, EST) ni offsets sueltos.
// - Convierte fecha calendario (AAAA-MM-DD) + timeMinute en esa zona a un
//   instante UTC con Intl/Date nativo (el plan sugiere `date-fns-tz` como
//   opción; se optó por nativo para no sumar dependencias).
// - PROHIBIDO concatenar fecha/hora + "Z": eso interpretaría la hora local
//   como UTC. Acá se calcula el offset real de la zona para ese instante.
//
// DST (documentado y seguro):
// - Hora inexistente (salto hacia adelante, p. ej. 02:30 el día del cambio):
//   se detecta porque el instante calculado no redondea a la misma hora local
//   → se lanza Error claro. No se inventa otra hora.
// - Hora ambigua (salto hacia atrás: la misma hora local ocurre dos veces):
//   se detecta probando offsets vecinos (±1..3 h); si otro offset produce un
//   instante distinto que también redondea a la misma hora local → Error claro.
//   No se elige una ocurrencia arbitraria.

import { canonicalTimeZone, isValidTimeZone } from "../validations/push";

export { canonicalTimeZone, isValidTimeZone };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Valida la zona con la regla estricta y devuelve su forma canónica. */
export function assertValidTimeZone(tz: unknown): string {
  if (typeof tz !== "string" || !isValidTimeZone(tz)) {
    throw new Error(
      "Zona horaria inválida: debe ser una zona IANA válida " +
        "(p. ej. America/Argentina/Buenos_Aires)."
    );
  }
  return canonicalTimeZone(tz);
}

type WallParts = { y: number; mo: number; d: number; h: number; mi: number };

function wallParts(utcMs: number, timeZone: string): WallParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: string): number => {
    const raw = parts.find((p) => p.type === type)?.value ?? "";
    return Number(raw);
  };
  // Con hour12:false algunos ICU devuelven "24" para la medianoche.
  const h24 = get("hour");
  return {
    y: get("year"),
    mo: get("month"),
    d: get("day"),
    h: h24 === 24 ? 0 : h24,
    mi: get("minute"),
  };
}

/** Offset de la zona (ms) tal que wallLocal = utc + offset. */
function offsetAt(utcMs: number, timeZone: string): number {
  const w = wallParts(utcMs, timeZone);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - utcMs;
}

/**
 * Convierte fecha calendario + minutos desde medianoche en `timeZone`
 * a un instante UTC (Date). Lanza Error claro si la fecha/hora es inválida,
 * la zona es inválida, la hora no existe por DST o es ambigua por DST.
 */
export function taskDateTimeToUtc(
  dateStr: string,
  timeMinute: number,
  timeZone: string
): Date {
  if (!DATE_RE.test(dateStr)) {
    throw new Error("Fecha inválida (AAAA-MM-DD).");
  }
  if (
    !Number.isInteger(timeMinute) ||
    timeMinute < 0 ||
    timeMinute > 1439
  ) {
    throw new Error("Hora inválida (0–1439 minutos desde medianoche).");
  }
  const zone = assertValidTimeZone(timeZone);
  const [y, mo, d] = dateStr.split("-").map(Number);
  // Rechaza fechas calendario inexistentes (p. ej. 2026-02-30): Date.UTC las
  // normaliza en silencio, así que se verifica el ida y vuelta.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d
  ) {
    throw new Error(`Fecha calendario inexistente: ${dateStr}.`);
  }
  const h = Math.floor(timeMinute / 60);
  const mi = timeMinute % 60;
  const wallMs = Date.UTC(y, mo - 1, d, h, mi);

  // Conversión pared → UTC con el offset real de la zona para ese instante.
  // Se refina una vez porque el offset puede cambiar justo en el límite DST.
  let offset = offsetAt(wallMs, zone);
  let utcMs = wallMs - offset;
  const refined = offsetAt(utcMs, zone);
  if (refined !== offset) {
    offset = refined;
    utcMs = wallMs - offset;
  }

  // 1) Hora inexistente (gap de DST): el instante no redondea a la hora local
  // pedida → error, no se inventa otra hora.
  const back = wallParts(utcMs, zone);
  if (
    back.y !== y ||
    back.mo !== mo ||
    back.d !== d ||
    back.h !== h ||
    back.mi !== mi
  ) {
    throw new Error(
      `La hora ${pad(h)}:${pad(mi)} del ${dateStr} no existe en ${zone} ` +
        "por el cambio de horario (DST). Elegí otra hora."
    );
  }

  // 2) Hora ambigua (la misma hora local ocurre dos veces al atrasar el
  // reloj): si algún offset vecino produce otro instante que también
  // redondea a la misma hora local → error, no se elige una ocurrencia.
  for (const deltaHours of [-3, -2, -1, 1, 2, 3]) {
    const otherOffset = offsetAt(utcMs + deltaHours * 3_600_000, zone);
    if (otherOffset === offset) continue;
    const altMs = wallMs - otherOffset;
    if (altMs === utcMs) continue;
    const altBack = wallParts(altMs, zone);
    if (
      altBack.y === y &&
      altBack.mo === mo &&
      altBack.d === d &&
      altBack.h === h &&
      altBack.mi === mi
    ) {
      throw new Error(
        `La hora ${pad(h)}:${pad(mi)} del ${dateStr} es ambigua en ${zone} ` +
          "por el cambio de horario (DST): ocurre dos veces. Elegí otra hora."
      );
    }
  }

  return new Date(utcMs);
}
