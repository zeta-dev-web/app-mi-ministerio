"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMinutes } from "@/lib/ministry";
import { RecordCard, type RecordCardData } from "../components/record-card";

export type CalDay = { day: number; minutes: number; taskCount: number };
export type CalRecord = RecordCardData & { day: number };

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function shiftKey(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return monthKey(d.getUTCFullYear(), d.getUTCMonth());
}

export function MonthCalendar({
  year,
  month,
  days,
  records,
  todayIso,
  selectedDay,
  urlBasePath,
  hideDayDetail = false,
}: {
  year: number;
  month: number; // 0-11
  days: CalDay[];
  records: CalRecord[];
  todayIso: string;
  /**
   * Modo controlado por URL (usado en /actividad):
   * - `selectedDay`: día seleccionado (o null sin filtro). Si se omite,
   *   el calendario usa estado local (comportamiento original).
   * - `urlBasePath`: si existe, habilita navegación por URL usando `?mes=` y `?dia=`.
   *   Se pasa como texto para mantener serializable el límite servidor/cliente.
   * - `hideDayDetail`: oculta el panel de detalle interno (la página padre
   *   renderiza su propia lista filtrada).
   */
  selectedDay?: number | null;
  urlBasePath?: string;
  hideDayDetail?: boolean;
}) {
  const first = new Date(Date.UTC(year, month, 1));
  // Lunes primero: getUTCDay() 0=domingo → offset (d+6)%7
  const offset = (first.getUTCDay() + 6) % 7;
  const byDay = new Map(days.map((d) => [d.day, d]));
  const recsByDay = new Map<number, CalRecord[]>();
  for (const r of records) {
    const arr = recsByDay.get(r.day) ?? [];
    arr.push(r);
    recsByDay.set(r.day, arr);
  }

  const todayDay = todayIso.slice(0, 7) === monthKey(year, month) ? Number(todayIso.slice(8, 10)) : null;
  const defaultSelected = todayDay ?? days.find((d) => d.minutes > 0)?.day ?? null;
  const [internalSelected, setInternalSelected] = useState<number | null>(defaultSelected);
  // Modo controlado por URL: si `selectedDay` viene definido (aunque sea null),
  // manda sobre el estado local.
  const selected = selectedDay !== undefined ? selectedDay : internalSelected;
  const setSelected = (v: number | null) => setInternalSelected(v);
  const selectedRecs = selected != null ? (recsByDay.get(selected) ?? []) : [];
  const selectedInfo = selected != null ? byDay.get(selected) : null;

  const cells: (number | null)[] = [...Array<number | null>(offset).fill(null), ...days.map((d) => d.day)];

  const currentMonthKey = monthKey(year, month);
  const prevMonthKey = shiftKey(year, month, -1);
  const nextMonthKey = shiftKey(year, month, 1);
  const prevLink = urlBasePath ? `${urlBasePath}?mes=${prevMonthKey}` : `?cal=${prevMonthKey}`;
  const nextLink = urlBasePath ? `${urlBasePath}?mes=${nextMonthKey}` : `?cal=${nextMonthKey}`;

  return (
    <section aria-label="Calendario" className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={prevLink}
          aria-label="Mes anterior"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted transition-colors hover:text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h2 className="font-display text-2xl tracking-tight">
          {MESES[month]} {year}
        </h2>
        <Link
          href={nextLink}
          aria-label="Mes siguiente"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted transition-colors hover:text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1" role="grid" aria-label={`${MESES[month]} ${year}`}>
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="pb-1 text-center text-xs font-medium text-muted">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <span key={`b-${i}`} />;
          const info = byDay.get(day);
          const isSelected = selected === day;
          const isToday = todayDay === day;
          const dayClass = `flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-md text-sm transition-transform active:scale-95 ${
            isSelected
              ? "bg-primary font-medium text-on-primary"
              : isToday
                ? "border border-primary"
                : "hover:bg-canvas"
          }`;
          const dayLabel = `${day} de ${MESES[month]}${info && info.minutes > 0 ? `, ${formatMinutes(info.minutes)}` : ""}`;
          const dots = (
            <span className="flex h-1.5 items-center gap-1" aria-hidden="true">
              {info && info.minutes > 0 && (
                <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-on-primary" : "bg-primary"}`} />
              )}
              {info && info.taskCount > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-ink" />
              )}
            </span>
          );
          // Modo URL: los días son links que filtran por ?dia=.
          // Tocar el día ya seleccionado limpia el filtro.
          if (urlBasePath) {
            const dayKey = `${currentMonthKey}-${String(day).padStart(2, "0")}`;
            return (
              <Link
                key={day}
                href={isSelected ? `${urlBasePath}?mes=${currentMonthKey}` : `${urlBasePath}?mes=${currentMonthKey}&dia=${dayKey}`}
                aria-pressed={isSelected}
                aria-label={dayLabel}
                className={dayClass}
              >
                <span>{day}</span>
                {dots}
              </Link>
            );
          }
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelected(isSelected ? null : day)}
              aria-pressed={isSelected}
              aria-label={dayLabel}
              className={dayClass}
            >
              <span>{day}</span>
              {dots}
            </button>
          );
        })}
      </div>

      {selected != null && !hideDayDetail && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-sm font-medium">
            {selected} de {MESES[month]} ·{" "}
            {selectedInfo && selectedInfo.minutes > 0 ? formatMinutes(selectedInfo.minutes) : "Sin actividad"}
            {selectedInfo && selectedInfo.taskCount > 0 && ` · ${selectedInfo.taskCount} asignación(es)`}
          </p>
          {selectedRecs.length > 0 ? (
            <div className="flex flex-col gap-2">
              {selectedRecs.map((r) => (
                <RecordCard key={r.id} record={r} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted">Sin registros este día.</p>
              <Link
                href={`?cargar=1`}
                className="flex min-h-[44px] items-center rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-transform active:scale-[0.98]"
              >
                + Agregar
              </Link>
            </div>
          )}
          {selectedInfo && selectedInfo.taskCount > 0 && (
            <Link href="/tareas" className="mt-2 inline-block text-sm text-primary underline">
              Ver asignaciones
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
