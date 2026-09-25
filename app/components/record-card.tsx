"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMinutes, minutesToTimeString } from "@/lib/ministry";

export type RecordCardData = {
  id: string;
  date: Date | string;
  minutes: number;
  startMinute: number | null;
  endMinute: number | null;
  didStudy: boolean;
  didVisit: boolean;
  notes: string | null;
  ministryType: { name: string };
  people: { person: { firstName: string; lastName: string | null } }[];
};

function dateText(value: Date | string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha inválida" : date.toISOString().slice(0, 10);
}

function peopleText(record: RecordCardData): string {
  return record.people
    .map((p) => `${p.person.firstName}${p.person.lastName ? ` ${p.person.lastName}` : ""}`)
    .join(", ");
}

export function RecordCard({ record, index = 0 }: { record: RecordCardData; index?: number }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const r = record;
  const hasSchedule = r.startMinute != null && r.endMinute != null;
  const linkedPeople = peopleText(r);

  useEffect(() => {
    if (!detailOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [detailOpen]);

  return (
    <>
      <article
        className="reveal rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        style={{ "--index": index } as React.CSSProperties}
      >
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            aria-label={`Ver detalle de la actividad del ${dateText(r.date)}`}
            className="flex min-w-0 flex-1 flex-col text-left transition-colors hover:text-primary focus-visible:rounded-md"
          >
            <span className="text-sm text-muted">{dateText(r.date)}</span>
            <span className="mt-1 font-display text-xl tabular-nums">{formatMinutes(r.minutes)}</span>
            <span className="mt-1 text-xs text-muted">Tipo de actividad: {r.ministryType.name}</span>
          </button>
          <Link
            href={`?editar=${r.id}`}
            aria-label="Editar registro"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center self-start rounded-md text-muted transition-colors hover:text-primary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
            </svg>
          </Link>
        </div>
      </article>

      {detailOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
          <button type="button" aria-label="Cerrar detalle" onClick={() => setDetailOpen(false)} className="absolute inset-0 cursor-default bg-black/40" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`record-detail-${r.id}`}
            className="sheet-in relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-canvas p-5 sm:max-w-lg sm:rounded-xl sm:border sm:border-line"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id={`record-detail-${r.id}`} className="font-display text-2xl tracking-tight">Detalle de actividad</h2>
              <button type="button" onClick={() => setDetailOpen(false)} aria-label="Cerrar detalle" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-line bg-surface text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-muted">Fecha</dt><dd className="font-medium">{dateText(r.date)}</dd></div>
              <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-muted">Duración</dt><dd className="font-medium tabular-nums">{formatMinutes(r.minutes)}</dd></div>
              <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-muted">Tipo de actividad</dt><dd className="text-right font-medium">{r.ministryType.name}</dd></div>
              {hasSchedule && <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-muted">Horario</dt><dd className="font-medium tabular-nums">{minutesToTimeString(r.startMinute!)}–{minutesToTimeString(r.endMinute!)}</dd></div>}
              <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-muted">Cursos bíblicos</dt><dd className="font-medium">{r.didStudy ? "Registrado" : "No registrado"}</dd></div>
              <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-muted">Revisitas</dt><dd className="font-medium">{r.didVisit ? "Registradas" : "No registradas"}</dd></div>
            </dl>

            {linkedPeople && <p className="mt-4 rounded-md border border-line bg-surface p-3 text-sm text-muted">Personas vinculadas ({r.people.length}): <span className="font-medium text-ink">{linkedPeople}</span></p>}
            {r.notes && <p className="mt-3 rounded-md border border-line bg-surface p-3 text-sm">{r.notes}</p>}
            <Link href={`?editar=${r.id}`} onClick={() => setDetailOpen(false)} className="mt-4 flex min-h-[48px] items-center justify-center rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary hover:bg-primary-strong">Editar registro</Link>
          </div>
        </div>
      )}
    </>
  );
}
