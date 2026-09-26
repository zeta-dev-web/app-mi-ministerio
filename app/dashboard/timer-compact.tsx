"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

function splitElapsed(totalSec: number): { hm: string; s: string } {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return { hm: h > 0 ? `${h}:${p(m)}` : `${p(m)}`, s: `:${p(sec)}` };
}

export function TimerCompact({
  initialRunning,
  initialElapsedSec,
}: {
  initialRunning: boolean;
  initialElapsedSec: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(initialRunning);
  const [elapsedSec, setElapsedSec] = useState(initialElapsedSec);
  const [serverNow, setServerNow] = useState<number>(() => Date.now());
  const [clockOffset, setClockOffset] = useState(0);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [confirmReset, setConfirmReset] = useState(false);

  async function sync() {
    try {
      const res = await fetch("/api/timer", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setRunning(data.running === true);
      setElapsedSec(Number(data.elapsedSec ?? 0));
      const syncedServerNow = Number(data.serverNow ?? Date.now());
      setServerNow(syncedServerNow);
      setClockOffset(syncedServerNow - Date.now());
    } catch {
      /* mantiene estado local */
    }
  }

  // Revalidación al montar: el servidor ya pasó initialRunning/initialElapsedSec,
  // pero el cliente necesita `serverNow` y su desfase de reloj para interpolar
  // el cronómetro. Todos los setState de sync() ocurren DESPUÉS del `await`, así
  // que no hay render en cascada; el linter no lo puede deducir al atravesar la
  // llamada a sync().
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sync();
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!confirmReset) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmReset(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmReset]);

  const live = running
    ? elapsedSec + Math.max(0, (now + clockOffset - serverNow) / 1000)
    : elapsedSec;
  const active = running || elapsedSec > 0;
  const { hm, s } = splitElapsed(live);

  function run(action: "start" | "pause" | "reset") {
    startTransition(async () => {
      try {
        const res = await fetch("/api/timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        setRunning(data.running === true);
        setElapsedSec(Number(data.elapsedSec ?? 0));
        const syncedServerNow = Number(data.serverNow ?? Date.now());
        setServerNow(syncedServerNow);
        setClockOffset(syncedServerNow - Date.now());
        setNow(Date.now());
      } catch {
        /* offline: no cambia */
      }
    });
  }

  function finish() {
    const minutes = Math.max(15, Math.round(live / 60 / 15) * 15);
    startTransition(async () => {
      try {
        await fetch("/api/timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pause" }),
        });
      } catch {
        /* igual abre el modal */
      }
      router.push(`?cargar=1&minutos=${minutes}`);
    });
  }

  return (
    <>
      <section
        aria-label="Cronómetro"
        className="timer-gradient reveal relative overflow-hidden rounded-3xl p-5 shadow-lg"
        style={{ "--index": 1 } as React.CSSProperties}
      >
      <span aria-hidden="true" className="timer-orb -top-12 -right-12 h-44 w-44" />
      <span aria-hidden="true" className="timer-orb -bottom-20 -left-10 h-44 w-44" />

      <div className="relative flex items-center justify-between gap-3">
        <span className="timer-text flex items-center gap-2 text-sm font-medium">
          {running ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              En predicación
            </>
          ) : active ? (
            "En pausa"
          ) : (
            "Cronómetro"
          )}
        </span>
      </div>

      <p
        className="relative mt-2 font-sans text-5xl font-bold tracking-tight tabular-nums"
        aria-live="polite"
      >
        {hm}
        <span className="timer-text-dim text-3xl">{s}</span>
      </p>

      <div className="relative mt-4 flex min-w-0 gap-1 sm:gap-2">
        {running ? (
          <button
            type="button"
            onClick={() => run("pause")}
            disabled={pending}
            aria-label="Pausar cronómetro"
            title="Pausar cronómetro"
            className="timer-action-secondary flex min-h-[52px] min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-2 font-semibold backdrop-blur transition active:scale-[0.98] disabled:opacity-60 sm:gap-2 sm:px-4"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
            <span className="hidden sm:inline">Pausar</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run("start")}
            disabled={pending}
            aria-label={active ? "Reanudar cronómetro" : "Iniciar cronómetro"}
            title={active ? "Reanudar cronómetro" : "Iniciar cronómetro"}
            className="timer-action-primary flex min-h-[52px] min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-2 font-semibold shadow-sm transition active:scale-[0.98] disabled:opacity-60 sm:gap-2 sm:px-4"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="hidden sm:inline">{active ? "Reanudar" : "Iniciar"}</span>
          </button>
        )}
        {active && (
          <button
            type="button"
            onClick={finish}
            disabled={pending}
            aria-label="Terminar y registrar cronómetro"
            title="Terminar y registrar cronómetro"
            className="timer-action-finish flex min-h-[52px] min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-2 font-semibold transition active:scale-[0.98] disabled:opacity-60 sm:gap-2 sm:px-4"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="hidden sm:inline">Terminar</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => (active ? setConfirmReset(true) : run("reset"))}
          disabled={pending || !active}
          className="timer-action-secondary flex min-h-[52px] min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-2 font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-4"
          aria-label="Reiniciar cronómetro"
          title="Reiniciar cronómetro"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
          <span className="hidden sm:inline">Reiniciar</span>
        </button>
      </div>
      </section>
      {confirmReset && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
          <button
            type="button"
            aria-label="Cerrar confirmación"
            onClick={() => setConfirmReset(false)}
            className="absolute inset-0 cursor-default bg-black/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="timer-reset-title"
            className="sheet-in relative w-full rounded-t-2xl bg-canvas p-5 sm:max-w-md sm:rounded-xl sm:border sm:border-line"
          >
            <h2 id="timer-reset-title" className="font-display text-2xl tracking-tight">¿Reiniciar cronómetro?</h2>
            <p className="mt-2 text-sm text-muted">Se perderá el tiempo acumulado.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-medium transition-transform active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  run("reset");
                }}
                disabled={pending}
                className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
