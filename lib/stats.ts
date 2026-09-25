/** Lógica pura de estadísticas: rangos y agrupado temporal. */

import { serviceYearOf, serviceYearRange } from "./service-year";

export type RangeKey = "mes-actual" | "mes-anterior" | "3m" | "6m" | "calendario" | "anio" | "personalizado";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "mes-actual", label: "Mes actual" },
  { key: "mes-anterior", label: "Mes anterior" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "calendario", label: "Año calendario" },
  { key: "anio", label: "Año de servicio" },
  { key: "personalizado", label: "Personalizado" },
];

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

export function resolveRange(
  key: RangeKey,
  now: Date,
  custom?: { from?: string; to?: string }
): { from: Date; to: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (key) {
    case "mes-anterior":
      return { from: utc(y, m - 1, 1), to: new Date(Date.UTC(y, m, 0, 23, 59, 59)) };
    case "3m":
      return { from: utc(y, m - 2, 1), to: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59)) };
    case "6m":
      return { from: utc(y, m - 5, 1), to: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59)) };
    case "calendario":
      return { from: utc(y, 0, 1), to: new Date(Date.UTC(y, 11, 31, 23, 59, 59)) };
    case "anio":
      return serviceYearRange(serviceYearOf(now));
    case "personalizado": {
      const from = custom?.from ? new Date(custom.from + "T00:00:00.000Z") : utc(y, m, 1);
      const to = custom?.to ? new Date(custom.to + "T23:59:59.000Z") : new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));
      return from <= to ? { from, to } : { from: to, to: from };
    }
    case "mes-actual":
    default:
      return { from: utc(y, m, 1), to: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59)) };
  }
}

export type Bucket = { key: string; label: string; minutes: number };

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Agrupa minutos por día/semana/mes según la amplitud del rango. */
export function bucketize(
  records: { date: Date; minutes: number }[],
  from: Date,
  to: Date
): { buckets: Bucket[]; granularity: "dia" | "semana" | "mes" } {
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
  const granularity = days <= 62 ? "dia" : days <= 186 ? "semana" : "mes";
  const map = new Map<string, Bucket>();

  if (granularity === "mes") {
    const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    while (cur <= end) {
      const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`;
      map.set(key, { key, label: `${MESES[cur.getUTCMonth()]} ${String(cur.getUTCFullYear()).slice(2)}`, minutes: 0 });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    for (const r of records) {
      const key = r.date.toISOString().slice(0, 7);
      const b = map.get(key);
      if (b) b.minutes += r.minutes;
    }
    return { buckets: [...map.values()], granularity };
  }

  // día o semana: recorre el rango para incluir buckets vacíos
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const endDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const step = granularity === "semana" ? 7 : 1;
  for (let d = new Date(start); d <= endDay; d.setUTCDate(d.getUTCDate() + step)) {
    const key = dayKey(d);
    const label =
      granularity === "semana"
        ? `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
        : String(d.getUTCDate());
    map.set(key + (granularity === "semana" ? `+${step}` : ""), { key, label, minutes: 0 });
  }
  for (const r of records) {
    const k = dayKey(new Date(r.date));
    if (granularity === "dia") {
      const b = map.get(k);
      if (b) b.minutes += r.minutes;
    } else {
      // acumula en la semana cuyo inicio <= día < inicio+7
      for (const b of map.values()) {
        const s = new Date(b.key + "T00:00:00.000Z").getTime();
        const t = new Date(k + "T00:00:00.000Z").getTime();
        if (t >= s && t < s + 7 * 86_400_000) {
          b.minutes += r.minutes;
          break;
        }
      }
    }
  }
  return { buckets: [...map.values()], granularity };
}

/** Formato corto para ejes: 2h, 1h 30', 30'. */
export function shortMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (h === 0) return `${m}'`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}'`;
}
