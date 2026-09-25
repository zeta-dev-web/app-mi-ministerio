"use client";

import Link from "next/link";
import { useState } from "react";
import { buildReportText, type ReportData } from "@/lib/report";

export function InformeClient({
  data,
  mesKey,
  prevKey,
  nextKey,
  submittedAt,
  recipientName,
  recipientPhone,
  hasActivity,
}: {
  data: ReportData;
  mesKey: string;
  prevKey: string;
  nextKey: string | null;
  submittedAt: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  hasActivity: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [preached, setPreached] = useState(hasActivity);
  const [sent, setSent] = useState<string | null>(submittedAt);
  const [saving, setSaving] = useState(false);
  const [canShare] = useState(
    () => typeof navigator !== "undefined" && "share" in navigator
  );
  const ready = !data.isPublisher || preached;
  const text = buildReportText(data, preached);

  async function autoMarkSent() {
    if (sent) return;
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: mesKey, submitted: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setSent(body.submittedAt ?? new Date().toISOString());
    } catch {
      /* sin conexión: queda pendiente */
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Informe ${data.monthLabel}`, text });
      autoMarkSent();
    } catch {
      /* cancelado por el usuario */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      autoMarkSent();
    } catch {
      /* portapapeles no disponible */
    }
  }

  async function markSubmitted(submitted: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: mesKey, submitted }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setSent(body.submittedAt ?? null);
    } finally {
      setSaving(false);
    }
  }

  const cleanPhone = (recipientPhone ?? "").replace(/\D/g, "");
  const recipientWa = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/informe?mes=${prevKey}`}
          aria-label="Mes anterior"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted transition-colors hover:text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="font-display text-fluid-3xl text-balance tracking-tight">
            Informe · {data.monthLabel}
          </h1>
          <Link href="/informe" className="text-xs font-medium text-muted underline underline-offset-2">
            Mes actual
          </Link>
        </div>
        {nextKey ? (
          <Link
            href={`/informe?mes=${nextKey}`}
            aria-label="Mes siguiente"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted transition-colors hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ) : (
          <span aria-hidden="true" className="min-h-[44px] min-w-[44px]" />
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        {sent ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-ink">
            Enviado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted">
            Pendiente
          </span>
        )}
        <p className="truncate text-xs text-muted">
          Para: {recipientName ? recipientName : "sin destinatario"}
        </p>
      </div>

      {hasActivity && !sent && (
        <p role="status" className="rounded-xl border border-line bg-primary-soft px-4 py-2.5 text-sm text-primary-ink">
          Actividad detectada este mes: al enviar se marcará como enviado automáticamente.
        </p>
      )}

      <section aria-label="Resumen" className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <p className="text-sm text-muted">
          {data.name}
          {data.congregation ? ` · Cong. ${data.congregation}` : ""}
        </p>
        <p className="mt-1 text-sm text-muted">{data.monthLabel}</p>
        {data.isPublisher ? (
          <label className="mt-3 flex min-h-[52px] cursor-pointer items-center gap-3 rounded-md border border-line px-3">
            <input
              type="checkbox"
              checked={preached}
              onChange={(e) => setPreached(e.target.checked)}
              className="h-5 w-5 accent-[#C05A2E]"
            />
            <span className="text-sm font-medium">Prediqué durante este mes</span>
          </label>
        ) : (
          <>
            <p className="font-display mt-1 text-5xl tracking-tight text-primary tabular-nums">
              {data.reportedHours ?? Math.floor(data.totalMinutes / 60)} h
            </p>
            {data.carryMinutes === true && (data.prevLeftover ?? 0) > 0 && (data.reportedHours ?? 0) > 0 && (
              <p className="mt-1 text-xs text-muted">
                Incluye {data.prevLeftover} min del mes anterior.
              </p>
            )}
            {data.goalHours != null && (
              <p className="mt-1 text-sm text-muted tabular-nums">Meta: {data.goalHours} h</p>
            )}
            <p className="mt-2 text-sm tabular-nums">
              Cursos bíblicos: {data.studyPersonCount}
            </p>
          </>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Enviar informe">
        {canShare && (
          <button
            type="button"
            onClick={share}
            disabled={!ready}
            className="col-span-2 flex min-h-[52px] items-center justify-center gap-2 rounded-md bg-primary px-4 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-50"
          >
            Enviar informe
          </button>
        )}
        {recipientWa ? (
          <a
            href={ready ? recipientWa : undefined}
            aria-disabled={!ready}
            onClick={(e) => {
              if (!ready) e.preventDefault();
              else autoMarkSent();
            }}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex min-h-[48px] items-center justify-center rounded-md border px-4 text-sm font-medium transition-transform active:scale-[0.98] ${
              ready
                ? "border-line bg-surface"
                : "pointer-events-none border-line bg-surface opacity-50"
            } ${!canShare && ready ? "col-span-2 border-primary bg-primary text-on-primary" : ""}`}
          >
            WhatsApp
          </a>
        ) : (
          <Link
            href="/perfil"
            className="flex min-h-[48px] items-center justify-center rounded-md border border-line bg-surface px-4 text-center text-sm font-medium"
          >
            Cargar destinatario en /perfil
          </Link>
        )}
        <button
          type="button"
          onClick={copy}
          disabled={!ready}
          className="flex min-h-[48px] items-center justify-center rounded-md border border-line bg-surface px-4 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {copied ? "¡Copiado!" : "Copiar texto"}
        </button>
      </div>
      {data.isPublisher && !preached && (
        <p className="text-center text-xs text-muted">Marcá si predicaste para poder enviar.</p>
      )}

      <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        {sent ? (
          <button
            type="button"
            onClick={() => markSubmitted(false)}
            disabled={saving}
            className="flex min-h-[48px] w-full items-center justify-center rounded-md border border-line bg-surface px-4 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Marcar pendiente"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => markSubmitted(true)}
            disabled={saving}
            className="flex min-h-[48px] w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Marcar enviado"}
          </button>
        )}
      </div>
    </div>
  );
}
