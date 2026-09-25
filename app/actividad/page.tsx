import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMinutes } from "@/lib/ministry";
import { MonthCalendar, type CalDay, type CalRecord } from "../dashboard/calendar";
import { RecordCard } from "../components/record-card";

export const metadata = { title: "Actividad" };

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parseMes(mes: string | undefined, now: Date): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? "");
  if (m) {
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { year: Number(m[1]), month: month - 1 };
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Valida ?dia=AAAA-MM-DD y que pertenezca al mes mostrado. Devuelve el día (1-31) o null. */
function parseDia(dia: string | undefined, year: number, month: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y !== year || mo !== month + 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  if (d < 1 || d > daysInMonth) return null;
  // Verifica fecha real (ej. rechaza combinaciones imposibles ya cubiertas arriba).
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return d;
}

export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; dia?: string }>;
}) {
  const { userId } = await requireUser();
  const now = new Date();
  const sp = await searchParams;
  const { year, month } = parseMes(sp.mes, now);
  const mesKey = `${year}-${pad2(month + 1)}`;
  const selectedDay = parseDia(sp.dia, year, month);
  const diaIso = selectedDay != null ? `${mesKey}-${pad2(selectedDay)}` : null;

  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

  const records = await db.ministryRecord.findMany({
    where: { userId, date: { gte: from, lte: to } },
    include: { ministryType: true, people: { include: { person: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  // Resumen del mes (servidor).
  const totalMinutes = records.reduce((acc, r) => acc + r.minutes, 0);
  const studyPersons = new Set<string>();
  for (const r of records) {
    if (r.didStudy) for (const p of r.people) studyPersons.add(p.person.id);
  }

  // Datos para el calendario.
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const minutesByDay = new Map<number, number>();
  for (const r of records) {
    const d = r.date.getUTCDate();
    minutesByDay.set(d, (minutesByDay.get(d) ?? 0) + r.minutes);
  }
  const days: CalDay[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return { day, minutes: minutesByDay.get(day) ?? 0, taskCount: 0 };
  });
  const calRecords: CalRecord[] = records.map((r) => ({
    ...r,
    day: r.date.getUTCDate(),
  }));

  const visible = selectedDay != null ? records.filter((r) => r.date.getUTCDate() === selectedDay) : records;
  const monthLabel = `${MESES[month]} ${year}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-fluid-3xl tracking-tight">Actividad</h1>
        <p className="mt-1 text-sm text-muted">{monthLabel}</p>
      </div>

      {/* Resumen del mes */}
      <section aria-label="Resumen del mes" className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-line bg-surface p-3 text-center">
          <p className="font-sans text-xl tabular-nums">{formatMinutes(totalMinutes)}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted">Horas del mes</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3 text-center">
          <p className="font-sans text-xl tabular-nums">{records.length}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted">Registros</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3 text-center">
          <p className="font-sans text-xl tabular-nums">{studyPersons.size}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted">Cursos bíblicos</p>
        </div>
      </section>

      {/* Calendario + lista (bento 2 col en lg) */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <MonthCalendar
          year={year}
          month={month}
          days={days}
          records={calRecords}
          todayIso={now.toISOString().slice(0, 10)}
          selectedDay={selectedDay}
          urlBasePath="/actividad"
          hideDayDetail
        />

        <section aria-label={diaIso ? `Actividades del ${diaIso}` : "Actividades del mes"} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">
              {diaIso
                ? `${selectedDay} de ${MESES[month]} · ${visible.length} registro(s)`
                : `Actividades del mes · ${visible.length}`}
            </h2>
            {diaIso && (
              <Link
                href={`/actividad?mes=${mesKey}`}
                className="flex min-h-[44px] items-center rounded-md border border-line bg-surface px-3 text-sm text-muted transition-colors hover:text-ink"
              >
                Limpiar día
              </Link>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface p-6 text-center">
              <p className="font-medium">{diaIso ? `Sin actividad el ${diaIso}` : "Sin registros este mes"}</p>
              <p className="mt-1 text-sm text-muted">
                {diaIso
                  ? "Tocá otro día del calendario o limpiá el filtro para ver todo el mes."
                  : "Registrá tu tiempo con el botón + Agregar."}
              </p>
              <Link
                href="?cargar=1"
                className="mt-3 inline-flex min-h-[44px] items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary transition-transform active:scale-[0.98]"
              >
                + Agregar
              </Link>
            </div>
          ) : (
            visible.map((r, i) => <RecordCard key={r.id} record={r} index={i} />)
          )}
        </section>
      </div>
    </div>
  );
}
