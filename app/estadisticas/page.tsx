import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMinutes } from "@/lib/ministry";
import { RANGES, bucketize, resolveRange, shortMinutes, type RangeKey } from "@/lib/stats";
import { serviceYearLabel, serviceYearMonths, serviceYearOf, serviceYearRange } from "@/lib/service-year";

const VALID: RangeKey[] = ["mes-actual", "mes-anterior", "3m", "6m", "calendario", "anio", "personalizado"];

function Chart({
  buckets,
}: {
  buckets: { key: string; label: string; minutes: number }[];
}) {
  const W = 640;
  const H = 240;
  const PAD_L = 44;
  const PAD_B = 28;
  const PAD_T = 12;
  const max = Math.max(60, ...buckets.map((b) => b.minutes));
  const iw = W - PAD_L - 8;
  const ih = H - PAD_T - PAD_B;
  const y = (v: number) => PAD_T + ih - (v / max) * ih;
  const slot = buckets.length > 0 ? iw / buckets.length : iw;
  const barW = Math.max(3, Math.min(22, slot * 0.55));
  const ticks = [0, 1, 2, 3].map((i) => (max / 3) * i);
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));

  return (
    <figure>
      <div className="flex flex-wrap gap-2 text-xs font-medium" aria-label="Leyenda">
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary-ink">● Real</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 hidden w-full sm:block"
        role="img"
        aria-label={`Gráfico de actividad por período. Total ${formatMinutes(buckets.reduce((a, b) => a + b.minutes, 0))}.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - 4} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t === 0 ? "" : "4 4"} />
            <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
              {shortMinutes(Math.round(t))}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const h = (b.minutes / max) * ih;
          const x = PAD_L + i * slot + (slot - barW) / 2;
          return (
            <g key={b.key}>
              {b.minutes > 0 && (
                <rect x={x} y={y(b.minutes)} width={barW} height={Math.max(2, h)} rx={Math.min(4, barW / 2)} fill="var(--color-primary)">
                  <title>{`${b.label}: ${formatMinutes(b.minutes)}`}</title>
                </rect>
              )}
              {i % labelEvery === 0 && (
                <text x={PAD_L + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-4 flex flex-col gap-3 sm:hidden" role="list" aria-label="Actividad por período en barras horizontales">
        {buckets.map((b) => {
          const realWidth = `${Math.min(100, (b.minutes / max) * 100)}%`;
          return (
            <div key={b.key} role="listitem" className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium">{b.label}</span>
                <span className="text-muted tabular-nums">{shortMinutes(b.minutes)}</span>
              </div>
              <div className="flex items-center gap-2" aria-label={`${b.label}: ${shortMinutes(b.minutes)}`}>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-primary-soft" role="progressbar" aria-valuenow={b.minutes} aria-valuemin={0} aria-valuemax={max} aria-label={`Real: ${shortMinutes(b.minutes)}`}>
                  <div className="h-full rounded-full bg-primary" style={{ width: realWidth }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; from?: string; to?: string; ano?: string }>;
}) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const rango: RangeKey = VALID.includes(sp.rango as RangeKey) ? (sp.rango as RangeKey) : "calendario";
  const now = new Date();
  const currentSY = serviceYearOf(now);
  const rawAno = sp.ano != null ? Number(sp.ano) : Number.NaN;
  const sy = Number.isInteger(rawAno) && rawAno >= 2000 && rawAno <= currentSY ? rawAno : currentSY;
  const { from, to } =
    rango === "anio" ? serviceYearRange(sy) : resolveRange(rango, now, { from: sp.from, to: sp.to });

  const [records, yearReports] = await Promise.all([
    db.ministryRecord.findMany({
      where: { userId, date: { gte: from, lte: to } },
      include: { people: { select: { personId: true } } },
      orderBy: { date: "asc" },
    }),
    rango === "anio"
      ? db.ministryReport.findMany({
          where: { userId, month: { in: serviceYearMonths(sy).map((m) => `${m.year}-${String(m.month + 1).padStart(2, "0")}`) } },
          select: { month: true, submittedAt: true },
        })
      : Promise.resolve([] as { month: string; submittedAt: Date | null }[]),
  ]);

  const { buckets, granularity } = bucketize(records, from, to);
  const total = records.reduce((a, r) => a + r.minutes, 0);
  const fromDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const calendarDays = Math.max(1, Math.floor((toDay - fromDay) / 86_400_000) + 1);
  const calendarMonths = Math.max(
    1,
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth() + 1,
  );
  const averageMonthly = total / calendarMonths;
  const averageDaily = total / calendarDays;
  const revisitsTotal = records.filter((r) => r.didVisit).length;
  const coursesDirectedTotal = records.reduce((sum, r) => sum + (r.didStudy ? r.people.length : 0), 0);
  const coursePeople = new Set<string>();
  for (const r of records) {
    if (r.didStudy) for (const p of r.people) coursePeople.add(p.personId);
  }
  const coursesDifferentTotal = coursePeople.size;

  const granLabel = granularity === "dia" ? "por día" : granularity === "semana" ? "por semana" : "por mes";

  const syMonths = rango === "anio" ? serviceYearMonths(sy) : [];
  const reportByMonth = new Map(yearReports.map((r) => [r.month, r.submittedAt]));
  const monthRows =
    rango === "anio"
      ? syMonths.map((m) => {
          const key = `${m.year}-${String(m.month + 1).padStart(2, "0")}`;
          const daysInMonth = new Date(Date.UTC(m.year, m.month + 1, 0)).getUTCDate();
          let minutes = 0;
          const studies = new Set<string>();
          for (const r of records) {
            if (r.date.toISOString().slice(0, 7) !== key) continue;
            minutes += r.minutes;
            if (r.didStudy) for (const p of r.people) studies.add(p.personId);
          }
          return {
            key,
            label: m.label,
            minutes,
            dailyAvg: minutes / daysInMonth,
            courses: studies.size,
            submittedAt: reportByMonth.get(key) ?? null,
          };
        })
      : [];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-fluid-3xl text-balance tracking-tight">Estadísticas</h1>

      <section aria-label="Seleccionar rango de datos" className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap gap-2">
          {RANGES.filter((r) => r.key !== "personalizado").map((r) => (
            <Link
              key={r.key}
              href={r.key === "anio" ? `/estadisticas?rango=anio&ano=${sy}` : `/estadisticas?rango=${r.key}`}
              aria-current={rango === r.key ? "true" : undefined}
              className={`flex min-h-[44px] items-center rounded-md border px-3 text-sm transition-colors ${
                rango === r.key ? "border-primary bg-primary-soft font-medium text-primary-ink" : "border-line"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="rango" value="personalizado" />
          <label className="flex flex-col gap-1 text-xs text-muted">
            Desde
            <input
              type="date"
              name="from"
              defaultValue={rango === "personalizado" ? sp.from : from.toISOString().slice(0, 10)}
              className="min-h-[44px] rounded-md border border-line bg-surface px-2 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Hasta
            <input
              type="date"
              name="to"
              defaultValue={rango === "personalizado" ? sp.to : to.toISOString().slice(0, 10)}
              className="min-h-[44px] rounded-md border border-line bg-surface px-2 text-sm text-ink"
            />
          </label>
          <button
            type="submit"
            className={`flex min-h-[44px] items-center rounded-md border px-3 text-sm transition-transform active:scale-[0.98] ${
              rango === "personalizado" ? "border-primary bg-primary-soft font-medium text-primary-ink" : "border-line"
            }`}
          >
            Personalizado
          </button>
        </form>
      </section>

      <section aria-label="Resumen del rango" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: "Horas totales", value: formatMinutes(total) },
          { label: "Revisitas totales", value: String(revisitsTotal) },
          { label: "Cursos dirigidos", value: String(coursesDirectedTotal) },
          { label: "Personas con curso", value: String(coursesDifferentTotal) },
        ].map((s, i) => (
          <div key={s.label} className="reveal rounded-xl border border-line bg-surface p-3 text-center" style={{ "--index": i } as React.CSSProperties}>
            <p className="text-[11px] font-medium tracking-[0.05em] text-muted uppercase">{s.label}</p>
            <p className="font-display text-2xl tabular-nums">{s.value}</p>
          </div>
        ))}
      </section>

      <section aria-label="Promedios del periodo" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-[11px] font-medium tracking-[0.05em] text-muted uppercase">Promedio mensual</p>
          <p className="mt-1 font-display text-2xl tabular-nums">{formatMinutes(Math.round(averageMonthly))}</p>
          <p className="mt-1 text-xs text-muted">{calendarMonths} mes{calendarMonths === 1 ? "" : "es"} calendario cubierto{calendarMonths === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-[11px] font-medium tracking-[0.05em] text-muted uppercase">Promedio diario</p>
          <p className="mt-1 font-display text-2xl tabular-nums">{formatMinutes(Math.round(averageDaily))}</p>
          <p className="mt-1 text-xs text-muted">{calendarDays} día{calendarDays === 1 ? "" : "s"} calendario del periodo</p>
        </div>
      </section>

      <section aria-label={`Actividad ${granLabel}`} className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Sin datos en este rango.</p>
        ) : (
          <Chart buckets={buckets} />
        )}
      </section>

      {rango === "anio" && (
        <>
          <nav aria-label="Elegir año de servicio" className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface p-3">
            <Link
              href={`/estadisticas?rango=anio&ano=${sy - 1}`}
              aria-label="Año de servicio anterior"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-line text-lg transition-transform active:scale-[0.98]"
            >
              ‹
            </Link>
            <div className="text-center">
              <p className="text-sm font-semibold">Año de servicio {serviceYearLabel(sy)}</p>
              <p className="text-xs text-muted">
                Septiembre {sy} – Agosto {sy + 1}
              </p>
            </div>
            {sy < currentSY ? (
              <Link
                href={`/estadisticas?rango=anio&ano=${sy + 1}`}
                aria-label="Año de servicio siguiente"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-line text-lg transition-transform active:scale-[0.98]"
              >
                ›
              </Link>
            ) : (
              <span aria-hidden className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-line opacity-40">
                ›
              </span>
            )}
          </nav>

          <section aria-label={`Detalle por mes del año de servicio ${serviceYearLabel(sy)}`} className="overflow-hidden rounded-xl border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
              Detalle por mes · {serviceYearLabel(sy)}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-medium tracking-[0.05em] text-muted uppercase">
                    <th scope="col" className="px-4 py-2.5">Mes</th>
                    <th scope="col" className="px-2 py-2.5 text-right">Total</th>
                    <th scope="col" className="px-2 py-2.5 text-right">Prom/día</th>
                    <th scope="col" className="px-2 py-2.5 text-center">Personas con curso</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Informe</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((row) => (
                    <tr key={row.key} className="border-b border-line transition-colors last:border-0 hover:bg-primary-soft/40">
                      <td className="px-4 py-3">
                        <Link href={`/informe?mes=${row.key}`} className="font-medium text-primary-ink underline-offset-2 hover:underline">
                          {row.label}
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-right font-semibold tabular-nums">{formatMinutes(row.minutes)}</td>
                      <td className="px-2 py-3 text-right text-muted tabular-nums">{formatMinutes(Math.round(row.dailyAvg))}</td>
                      <td className="px-2 py-3 text-center tabular-nums">{row.courses}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/informe?mes=${row.key}`} className="inline-flex min-h-[44px] items-center justify-end sm:min-h-0">
                          {row.submittedAt ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-ink">
                              <span aria-hidden>✓</span> enviado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2.5 py-1 text-xs font-medium text-amber-ink">
                              <span aria-hidden>●</span> pendiente
                            </span>
                          )}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-primary-soft/40 text-sm font-bold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-2 py-3 text-right tabular-nums">{formatMinutes(total)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{formatMinutes(Math.round(averageDaily))}/día</td>
                    <td className="px-2 py-3 text-center tabular-nums">{coursesDifferentTotal}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-muted">
              <span>✓ enviado</span>
              <span>● pendiente de enviar</span>
            </p>
          </section>
        </>
      )}
    </div>
  );
}
