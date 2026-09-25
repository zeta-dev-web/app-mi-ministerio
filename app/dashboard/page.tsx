import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMinutes } from "@/lib/ministry";
import { serviceYearLabel, serviceYearOf, serviceYearRange } from "@/lib/service-year";
import { TimerCompact } from "./timer-compact";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

function monthRange(now: Date, offset = 0) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0, 23, 59, 59));
  return { start, end };
}

function fechaCorta(date: Date): string {
  return `${date.getUTCDate()} de ${MESES[date.getUTCMonth()].toLowerCase()}`;
}

function fechaLarga(now: Date): string {
  const dia = DIAS[now.getUTCDay()];
  const fecha = `${dia}, ${now.getUTCDate()} de ${MESES[now.getUTCMonth()].toLowerCase()} de ${now.getUTCFullYear()}`;
  return fecha.charAt(0).toUpperCase() + fecha.slice(1);
}

export default async function DashboardPage() {
  const { userId } = await requireUser();
  const now = new Date();
  const { start, end } = monthRange(now);
  const previous = monthRange(now, -1);
  const syStartYear = serviceYearOf(now);
  const sy = serviceYearRange(syStartYear);

  const [user, records, pendingTasks, pendingCount, syAgg, bibleBooks, bibleReads, previousRecords, previousReport, upcomingPeople, recentRecords] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, include: { serviceRole: true } }),
    db.ministryRecord.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: { ministryType: true, people: { select: { personId: true } } },
    }),
    db.ministryTask.findMany({
      where: { userId, status: "PENDING" },
      orderBy: [{ date: "asc" }, { timeMinute: "asc" }],
      take: 3,
    }),
    db.ministryTask.count({ where: { userId, status: "PENDING" } }),
    db.ministryRecord.aggregate({
      where: { userId, date: { gte: sy.from, lte: sy.to } },
      _sum: { minutes: true },
    }),
    db.bibleBook.findMany({ orderBy: { sortOrder: "asc" } }),
    db.bibleReading.findMany({ where: { userId }, select: { bookId: true, chapter: true } }),
    db.ministryRecord.findMany({
      where: { userId, date: { gte: previous.start, lte: previous.end } },
      select: { didStudy: true, didVisit: true, minutes: true },
    }),
    db.ministryReport.findUnique({
      where: { userId_month: { userId, month: `${previous.start.getUTCFullYear()}-${String(previous.start.getUTCMonth() + 1).padStart(2, "0")}` } },
      select: { submittedAt: true },
    }),
    db.interestedPerson.findMany({
      where: { userId, status: { not: "archivado" }, nextVisitDate: { not: null } },
      orderBy: [{ nextVisitDate: "asc" }, { nextVisitTime: "asc" }],
      take: 4,
      select: { id: true, firstName: true, lastName: true, nextVisitDate: true, nextVisitTime: true, nextTopic: true },
    }),
    db.ministryRecord.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 4,
      include: { ministryType: { select: { name: true } } },
    }),
  ]);

  const total = records.reduce((acc, r) => acc + r.minutes, 0);
  const goalMinutes = user?.personalGoalHours ? user.personalGoalHours * 60 : null;
  const goalPct = goalMinutes ? Math.min(100, Math.round((total / goalMinutes) * 100)) : null;
  const monthName = `${MESES[now.getUTCMonth()]} de ${now.getUTCFullYear()}`;

  // Cursos bíblicos del mes: personas distintas con estudio.
  const studyPersons = new Set<string>();
  for (const r of records) {
    if (r.didStudy) for (const p of r.people) studyPersons.add(p.personId);
  }

  const selectedBibleBook = bibleBooks.find((book) => book.id === user?.bibleSelectedBookId)
    ?? bibleBooks.find((book) => book.name === "Génesis" || book.name === "Genesis")
    ?? bibleBooks[0];
  const selectedBibleRead = selectedBibleBook ? bibleReads.filter((read) => read.bookId === selectedBibleBook.id) : [];
  const selectedBibleNext = selectedBibleBook
    ? Array.from({ length: selectedBibleBook.chapters }, (_, index) => index + 1).find(
        (chapter) => !selectedBibleRead.some((read) => read.chapter === chapter),
      )
    : null;

  const fullName = user?.name?.trim() || "amigo";
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const initial = (firstName.charAt(0) || "M").toUpperCase();
  const needsReport = previousRecords.length > 0 && !previousReport?.submittedAt;

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado Inicio */}
      <div className="reveal flex items-center justify-between gap-3" style={{ "--index": 0 } as React.CSSProperties}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{fechaLarga(now)}</p>
          <h1 className="truncate font-display text-fluid-3xl text-balance tracking-tight">
            Hola, {firstName}
          </h1>
        </div>
        <Link
          href="/perfil"
          aria-label="Ir a Mi Perfil"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary font-sans text-sm font-bold text-on-primary shadow-sm transition-transform active:scale-95"
        >
          {initial}
        </Link>
      </div>

      {needsReport ? (
        <Link
          href={`/informe?mes=${previous.start.getUTCFullYear()}-${String(previous.start.getUTCMonth() + 1).padStart(2, "0")}`}
          className="reveal flex items-center gap-3 rounded-3xl bg-amber-soft p-4 ring-1 ring-amber-ink/20 transition-transform active:scale-[0.99]"
          style={{ "--index": 1 } as React.CSSProperties}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-ink text-white" aria-hidden="true">!</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Tu informe de {MESES[previous.start.getUTCMonth()].toLowerCase()} está listo</span>
            <span className="block text-sm text-muted">Revisalo y compartilo cuando quieras.</span>
          </span>
          <span aria-hidden="true" className="text-primary">→</span>
        </Link>
      ) : null}

      {/* Cronómetro compacto */}
      <TimerCompact
        initialRunning={user?.timerStartedAt != null}
        initialElapsedSec={
          user?.timerStartedAt != null
            ? user.timerAccumulatedSec +
              Math.max(0, Math.floor((Date.now() - user.timerStartedAt.getTime()) / 1000))
            : (user?.timerAccumulatedSec ?? 0)
        }
      />

      {/* Meta mensual */}
      <section
        className="reveal rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-ink/5"
        style={{ "--index": 2 } as React.CSSProperties}
        aria-label="Meta mensual"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-medium tracking-[0.05em] text-muted uppercase">
            Meta de {monthName}
          </h2>
          {goalMinutes != null && goalPct != null && (
            <span className="font-sans text-sm tabular-nums text-muted">{goalPct}%</span>
          )}
        </div>
        <div className="mt-4 flex items-center gap-5">
          <div
            className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-primary) ${goalPct ?? 0}%, var(--color-primary-soft) 0)`,
            }}
            aria-label={goalPct != null ? `${goalPct}% de la meta mensual` : "Meta mensual sin definir"}
            role="img"
          >
            <div className="grid h-20 w-20 place-items-center rounded-full bg-surface text-center">
              <span className="font-sans text-2xl font-bold tracking-tight text-primary tabular-nums">
                {formatMinutes(total)}
              </span>
              {goalMinutes != null ? (
                <span className="-mt-1 text-xs font-medium text-muted">de {user?.personalGoalHours} h</span>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-2 border-b border-line pb-2">
              <span className="text-muted">Registrado</span>
              <span className="font-semibold tabular-nums">{formatMinutes(total)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-b border-line pb-2">
              <span className="text-muted">Registros</span>
              <span className="font-semibold tabular-nums">{records.length}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted">Cursos bíblicos</span>
              <span className="font-semibold tabular-nums">{studyPersons.size}</span>
            </div>
          </div>
        </div>
        {goalMinutes != null && goalPct != null ? (
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-primary-soft"
            role="progressbar"
            aria-valuenow={goalPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso de la meta mensual"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${goalPct}%` }} />
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link
            href="/perfil"
            className="flex min-h-[48px] items-center justify-center rounded-xl border border-primary bg-primary-soft px-3 text-center text-sm font-semibold text-primary-ink transition-transform hover:bg-primary hover:text-on-primary active:scale-[0.98]"
          >
            Definir METAS
          </Link>
          <Link
            href="/estadisticas"
            className="flex min-h-[48px] items-center justify-center rounded-xl border border-line bg-surface px-3 text-center text-sm font-semibold text-ink transition-colors hover:bg-canvas active:scale-[0.98]"
          >
            Ver estadísticas
          </Link>
          <Link
            href="/informe"
            className="flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-3 text-center text-sm font-semibold text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98]"
          >
            Enviar informe
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Resumen del mes" className="reveal grid grid-cols-2 gap-2 sm:grid-cols-4" style={{ "--index": 3 } as React.CSSProperties}>
        <div className="rounded-3xl bg-surface p-3 text-center shadow-sm ring-1 ring-ink/5">
          <p className="font-sans text-xl tabular-nums">{formatMinutes(total)}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted">Horas del mes</p>
        </div>
        <div className="rounded-3xl bg-surface p-3 text-center shadow-sm ring-1 ring-ink/5">
          <p className="font-sans text-xl tabular-nums">{studyPersons.size}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted">Cursos bíblicos</p>
        </div>
        <div className="rounded-3xl bg-surface p-3 text-center shadow-sm ring-1 ring-ink/5">
          <p className="font-sans text-xl tabular-nums">{pendingCount}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted">Asign. pendientes</p>
        </div>
        <div className="rounded-3xl bg-surface p-3 text-center shadow-sm ring-1 ring-ink/5">
          <p className="font-sans text-xl tabular-nums">{records.length}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted">Registros</p>
        </div>
      </section>

      {/* Año de servicio */}
      <section
        aria-label="Total año de servicio"
        className="reveal rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-ink/5"
        style={{ "--index": 4 } as React.CSSProperties}
      >
        <p className="text-xs font-medium tracking-[0.05em] text-muted uppercase">
          Año de servicio {serviceYearLabel(syStartYear)}
        </p>
        <p className="mt-1 font-sans text-3xl tracking-tight tabular-nums">
          {formatMinutes(syAgg._sum.minutes ?? 0)}
        </p>
        <p className="mt-1 text-sm text-muted">sept–ago</p>
      </section>

      {/* Biblia */}
      <section aria-label="Lectura de la Biblia">
        <Link
          href="/biblia"
          className="reveal flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-ink/5 transition-transform active:scale-[0.99]"
          style={{ "--index": 5 } as React.CSSProperties}
        >
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">Lectura de la Biblia personal</span>
            <span className="truncate font-sans text-sm text-muted">
              {selectedBibleBook && selectedBibleNext ? `${selectedBibleBook.name} ${selectedBibleNext}` : "Libro completado"}
            </span>
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </section>

      {/* Próximas asignaciones */}
      <section aria-label="Próximas asignaciones">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium tracking-[0.05em] text-muted uppercase">Próximas asignaciones</h2>
          <Link href="/tareas" className="text-sm text-primary underline">
            Ver todas
          </Link>
        </div>
        <div className="rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-ink/5">
          {pendingTasks.length === 0 ? (
            <p className="text-sm text-muted">Sin asignaciones</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {pendingTasks.map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
                  <span className="truncate font-medium">
                    {t.type}
                    {t.topic ? <span className="font-normal text-muted"> · {t.topic}</span> : ""}
                  </span>
                  <span className="shrink-0 font-sans text-muted tabular-nums">{t.date.toISOString().slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Próximas visitas">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium tracking-[0.05em] text-muted uppercase">Próximas visitas</h2>
          <Link href="/personas" className="text-sm text-primary underline">Ver todas</Link>
        </div>
        <div className="overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-ink/5">
          {upcomingPeople.length === 0 ? (
            <Link href="/personas" className="block p-4 text-sm text-muted">No hay visitas programadas.</Link>
          ) : (
            <ul className="divide-y divide-line">
              {upcomingPeople.map((person) => (
                <li key={person.id}>
                  <Link href="/personas" className="flex items-center gap-3 p-4 transition-colors hover:bg-canvas">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-sm font-semibold text-primary-ink" aria-hidden="true">
                      {(person.firstName.charAt(0) || "?").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{person.firstName}{person.lastName ? ` ${person.lastName}` : ""}</span>
                      <span className="block truncate text-sm text-muted">{person.nextTopic || "Visita"}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted tabular-nums">
                      {person.nextVisitDate ? fechaCorta(person.nextVisitDate) : ""}{person.nextVisitTime ? ` · ${person.nextVisitTime}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Actividad reciente">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium tracking-[0.05em] text-muted uppercase">Actividad reciente</h2>
          <Link href="/actividad" className="text-sm text-primary underline">Ver todo</Link>
        </div>
        <div className="overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-ink/5">
          {recentRecords.length === 0 ? (
            <p className="p-4 text-sm text-muted">Todavía no hay registros.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentRecords.map((record) => (
                <li key={record.id}>
                  <Link href={`/actividad?fecha=${record.date.toISOString().slice(0, 10)}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-canvas">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink" aria-hidden="true">✓</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{record.ministryType.name}</span>
                      <span className="block text-sm text-muted">{fechaCorta(record.date)}</span>
                    </span>
                    <span className="shrink-0 font-sans text-sm font-semibold tabular-nums">{formatMinutes(record.minutes)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
