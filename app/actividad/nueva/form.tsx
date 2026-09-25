"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { minutesToTimeString } from "@/lib/ministry";
import { useToast } from "../../components/toast";

function toMinutes(hhmm: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  return h * 60 + m;
}

const inputCls =
  "min-h-[48px] rounded-md border border-line bg-surface px-3 py-2 text-base placeholder:text-muted";

type Option = { id: string; name: string };
type PersonOption = { id: string; label: string };

export type RecordInitial = {
  id: string;
  date: string;
  startMinute: number | null;
  endMinute: number | null;
  manualHours: number | null;
  manualMinutes: number | null;
  ministryTypeId: string;
  didStudy: boolean;
  didVisit: boolean;
  personIds: string[];
  notes: string;
};

/* ---------------- Cronómetro ---------------- */

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

function Stopwatch({
  onApply,
}: {
  onApply: (hours: number, minutes: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [baseSec, setBaseSec] = useState(0);
  const [baseAt, setBaseAt] = useState<number>(() => Date.now());
  const [displayMs, setDisplayMs] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  // Carga inicial desde el servidor, con compensación simple de latencia.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/timer", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok) return;
        const rtt = Date.now() - t0;
        // Compensación simple: la mitad del RTT como latencia estimada.
        const base = Date.now() - Math.round(rtt / 2);
        setRunning(data.running === true);
        setBaseSec(Number(data.elapsedSec ?? 0));
        setBaseAt(base);
        setDisplayMs(Number(data.elapsedSec ?? 0) * 1000);
      } catch {
        if (alive) setNotice("No se pudo sincronizar el cronómetro.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Reloj vivo mientras corre.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setDisplayMs(baseSec * 1000 + (Date.now() - baseAt));
    }, 500);
    return () => clearInterval(id);
  }, [running, baseSec, baseAt]);

  function syncFromServer(data: { running?: boolean; elapsedSec?: number }) {
    setRunning(data.running === true);
    setBaseSec(Number(data.elapsedSec ?? 0));
    setBaseAt(Date.now());
    setDisplayMs(Number(data.elapsedSec ?? 0) * 1000);
  }

  async function playPause() {
    if (stopped) {
      // Restart local: el servidor ya quedó en 0 al frenar.
      setStopped(false);
      setBaseSec(0);
      setBaseAt(Date.now());
      setDisplayMs(0);
      setNotice(null);
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: running ? "pause" : "start" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "No se pudo actualizar el cronómetro.");
        return;
      }
      setNotice(null);
      syncFromServer(data);
    } catch {
      setNotice("Sin conexión: reintentá.");
    } finally {
      setPending(false);
    }
  }

  async function stop() {
    const elapsedMs = running ? baseSec * 1000 + (Date.now() - baseAt) : displayMs;
    setDisplayMs(elapsedMs);
    setStopped(true);
    setRunning(false);
    if (elapsedMs < 15 * 60 * 1000) {
      const s = Math.floor(elapsedMs / 1000);
      setNotice(`Muy poco tiempo (${s} s). El mínimo para registrar es 15 minutos.`);
      return;
    }
    const totalMin = Math.floor(elapsedMs / 60000);
    const rounded = Math.floor(totalMin / 15) * 15;
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    if (h > 24) {
      onApply(24, 0);
      setNotice("Pasaron más de 24 h: cargué el máximo, agregá el resto en otro registro.");
    } else {
      onApply(h, m);
      setNotice(null);
    }
    // Limpia el servidor tras volcar al registro.
    try {
      await fetch("/api/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
    } catch {
      /* el volcado manual ya quedó aplicado */
    }
    setBaseSec(Math.floor(elapsedMs / 1000));
    setBaseAt(Date.now());
  }

  async function restart() {
    setPending(true);
    try {
      const res = await fetch("/api/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) syncFromServer({ running: false, elapsedSec: 0 });
      else setNotice(data.error ?? "No se pudo reiniciar.");
      setStopped(false);
      if (res.ok) setNotice(null);
    } catch {
      setNotice("Sin conexión: reintentá.");
    } finally {
      setPending(false);
    }
  }

  const status = stopped ? "stopped" : running ? "running" : baseSec > 0 || displayMs > 0 ? "paused" : "idle";

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface p-4" aria-label="Cronómetro">
      <p className="font-sans text-4xl tabular-nums" aria-live="polite">
        {loading ? "--:--" : formatElapsed(displayMs)}
      </p>
      {!loading && (
        <p className="text-xs text-muted">
          {running ? "En marcha (guardado en servidor)" : stopped ? "Detenido" : baseSec > 0 ? "En pausa (guardado en servidor)" : "Listo para iniciar"}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={playPause}
          disabled={loading || pending}
          aria-label={
            running ? "Pausar cronómetro" : stopped ? "Reiniciar cronómetro" : "Iniciar cronómetro"
          }
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_4px_16px_rgba(192,90,46,0.35)] transition-transform active:scale-95 disabled:opacity-60"
        >
          {running ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : stopped ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        {(status === "running" || status === "paused") && (
          <button
            type="button"
            onClick={stop}
            disabled={pending}
            aria-label="Detener y cargar al registro"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface transition-transform active:scale-95 disabled:opacity-60"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}
        {(status === "paused" || stopped) && (
          <button
            type="button"
            onClick={restart}
            disabled={pending}
            aria-label="Reiniciar cronómetro"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface text-sm font-medium text-muted transition-transform active:scale-95 disabled:opacity-60"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
        )}
      </div>
      {notice && (
        <p role="alert" className="w-full rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
          {notice}
        </p>
      )}
    </div>
  );
}

/* ---------------- Reloj analógico ---------------- */

function ClockPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = toMinutes(value) ?? 0;
  const h24 = Math.floor(parsed / 60);
  const min = parsed % 60;
  const [view, setView] = useState<"hour" | "minute">("hour");
  const [open, setOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const SIZE = 264;
  const C = SIZE / 2;
  const R = 100;

  const isPM = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  function emit(h24v: number, minv: number) {
    onChange(`${String(h24v).padStart(2, "0")}:${String(minv).padStart(2, "0")}`);
  }

  function pick(clientX: number, clientY: number) {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (view === "hour") {
      const picked12 = Math.round(deg / 30) % 12;
      const h12v = picked12 === 0 ? 12 : picked12;
      emit((h12v % 12) + (isPM ? 12 : 0), min);
      setView("minute");
    } else {
      emit(h24, Math.round(deg / 6) % 60);
    }
  }

  const hourAngle = ((h12 % 12) / 12) * 360;
  const minAngle = (min / 60) * 360;
  const hand = (angle: number, len: number) => ({
    x2: C + len * Math.sin((angle * Math.PI) / 180),
    y2: C - len * Math.cos((angle * Math.PI) / 180),
  });
  const hh = hand(hourAngle, 52);
  const mh = hand(minAngle, 78);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`${inputCls} flex w-full items-center justify-between`}
      >
        <span className="font-sans text-2xl tabular-nums">{value || "--:--"}</span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-muted">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setView("hour")}
              aria-pressed={view === "hour"}
              className={`rounded-md px-3 py-2 font-sans text-3xl tabular-nums ${view === "hour" ? "bg-primary-soft text-primary-ink" : "text-muted"}`}
            >
              {String(h24).padStart(2, "0")}
            </button>
            <span className="font-sans text-3xl text-muted">:</span>
            <button
              type="button"
              onClick={() => setView("minute")}
              aria-pressed={view === "minute"}
              className={`rounded-md px-3 py-2 font-sans text-3xl tabular-nums ${view === "minute" ? "bg-primary-soft text-primary-ink" : "text-muted"}`}
            >
              {String(min).padStart(2, "0")}
            </button>
            <div className="ml-2 flex flex-col gap-1 text-xs font-medium" role="group" aria-label="AM o PM">
              {(["AM", "PM"] as const).map((ap) => (
                <button
                  key={ap}
                  type="button"
                  aria-pressed={(ap === "PM") === isPM}
                  onClick={() => {
                    const base = h12 % 12;
                    emit(base + (ap === "PM" ? 12 : 0), min);
                  }}
                  className={`min-h-[36px] rounded-md border px-2 ${
                    (ap === "PM") === isPM ? "border-primary bg-primary font-medium text-on-primary" : "border-line text-muted"
                  }`}
                >
                  {ap}
                </button>
              ))}
            </div>
          </div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mx-auto mt-3 w-full max-w-[264px] touch-none select-none"
            role="slider"
            aria-label={view === "hour" ? "Seleccionar hora" : "Seleccionar minutos"}
            aria-valuemin={view === "hour" ? 1 : 0}
            aria-valuemax={view === "hour" ? 12 : 59}
            aria-valuenow={view === "hour" ? h12 : min}
            tabIndex={0}
            onKeyDown={(e) => {
              if (view === "hour") {
                if (e.key === "ArrowRight" || e.key === "ArrowUp") emit((h24 + 1) % 24, min);
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") emit((h24 + 23) % 24, min);
              } else {
                if (e.key === "ArrowRight" || e.key === "ArrowUp") emit(h24, (min + 1) % 60);
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") emit(h24, (min + 59) % 60);
              }
            }}
            onPointerDown={(e) => {
              dragging.current = true;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              pick(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (dragging.current) pick(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
          >
            <circle cx={C} cy={C} r={R + 14} fill="var(--color-canvas)" />
            {view === "hour"
              ? Array.from({ length: 12 }, (_, i) => {
                  const n = i === 0 ? 12 : i;
                  const a = (i * 30 * Math.PI) / 180;
                  const x = C + R * Math.sin(a);
                  const y = C - R * Math.cos(a);
                  const sel = n === h12;
                  return (
                    <g key={n}>
                      <circle cx={x} cy={y} r={17} fill={sel ? "var(--color-primary)" : "transparent"} />
                      <text x={x} y={y + 6} textAnchor="middle" fontSize="16" fontWeight={sel ? 700 : 400} fill={sel ? "var(--color-on-primary)" : "var(--color-ink)"}>
                        {n}
                      </text>
                    </g>
                  );
                })
              : Array.from({ length: 60 }, (_, i) => {
                  const a = (i * 6 * Math.PI) / 180;
                  const x = C + R * Math.sin(a);
                  const y = C - R * Math.cos(a);
                  const major = i % 5 === 0;
                  const sel = i === min;
                  return (
                    <g key={i}>
                      {sel && <circle cx={x} cy={y} r={15} fill="var(--color-primary)" />}
                      {major && !sel && (
                        <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fill="var(--color-ink)">
                          {String(i).padStart(2, "0")}
                        </text>
                      )}
                      {!major && !sel && <circle cx={x} cy={y} r={2} fill="var(--color-muted)" />}
                      {sel && (
                        <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight={700} fill="var(--color-on-primary)">
                          {String(i).padStart(2, "0")}
                        </text>
                      )}
                    </g>
                  );
                })}
            <line x1={C} y1={C} x2={hh.x2} y2={hh.y2} stroke="var(--color-ink)" strokeWidth={5} strokeLinecap="round" />
            <line x1={C} y1={C} x2={mh.x2} y2={mh.y2} stroke="var(--color-primary)" strokeWidth={3} strokeLinecap="round" />
            <circle cx={C} cy={C} r={5} fill="var(--color-primary)" />
          </svg>
          <p className="mt-2 text-center text-xs text-muted">
            Tocá o arrastrá la aguja {view === "hour" ? "de la hora" : "de los minutos"}.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Scroll infinito ---------------- */

const ITEM_H = 44;

function WheelPicker({
  label,
  values,
  value,
  onChange,
  format,
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  const SETS = 7;
  const setH = values.length * ITEM_H;
  const items = Array.from({ length: SETS }, () => values).flat();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = values.indexOf(value);
    // El recuadro central está a 44px del tope: se resta un ítem para centrar el valor.
    el.scrollTop = 3 * setH + (idx >= 0 ? idx : 0) * ITEM_H - ITEM_H;
    last.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el) return;
        let st = el.scrollTop;
        if (st < setH) {
          st += setH * (SETS - 2);
          el.scrollTop = st;
        } else if (st > setH * (SETS - 1)) {
          st -= setH * (SETS - 2);
          el.scrollTop = st;
        }
        const idx = ((Math.round((st + ITEM_H) / ITEM_H) % values.length) + values.length) % values.length;
        const v = values[idx];
        if (v !== last.current) {
          last.current = v;
          onChange(v);
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [onChange, setH, values]);

  function step(delta: number) {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollTop + delta * ITEM_H, behavior: "smooth" });
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-xs font-medium tracking-[0.05em] text-muted uppercase">{label}</span>
      <button type="button" onClick={() => step(-1)} aria-label={`Subir ${label}`} className="flex min-h-[36px] min-w-[44px] items-center justify-center text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 15l-6-6-6 6" /></svg>
      </button>
      <div className="relative w-full">
        <div
          ref={ref}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowLeft") step(-1);
            if (e.key === "ArrowDown" || e.key === "ArrowRight") step(1);
          }}
          className="h-[132px] snap-y snap-mandatory overflow-y-auto overscroll-contain"
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((v, i) => (
            <div
              key={i}
              role="option"
              aria-selected={v === value}
              className={`flex h-[44px] snap-center items-center justify-center text-lg tabular-nums transition-colors ${
                v === value ? "font-bold text-primary" : "text-muted"
              }`}
            >
              {format(v)}
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[44px]" style={{ background: "linear-gradient(var(--color-canvas), transparent)" }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[44px]" style={{ background: "linear-gradient(transparent, var(--color-canvas))" }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-[44px] h-[44px] rounded-md border border-primary" />
      </div>
      <button type="button" onClick={() => step(1)} aria-label={`Bajar ${label}`} className="flex min-h-[36px] min-w-[44px] items-center justify-center text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </div>
  );
}

/* ---------------- Formulario ---------------- */

export function RecordForm({
  onSaved,
  initial,
  onDelete,
  presetMinutes,
}: {
  onSaved?: () => void;
  initial?: RecordInitial;
  onDelete?: () => void;
  presetMinutes?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const editing = initial != null;
  const presetH = presetMinutes != null && !editing ? Math.floor(presetMinutes / 60) : null;
  const presetM = presetMinutes != null && !editing ? presetMinutes % 60 : null;
  const [date, setDate] = useState(initial?.date ?? today);
  const [mode, setMode] = useState<"auto" | "manual">(
    initial?.manualHours != null || presetH != null ? "manual" : "auto"
  );
  const [start, setStart] = useState(
    initial?.startMinute != null ? minutesToTimeString(initial.startMinute) : "09:00"
  );
  const [end, setEnd] = useState(
    initial?.endMinute != null ? minutesToTimeString(initial.endMinute) : "10:00"
  );
  const [manualHours, setManualHours] = useState(initial?.manualHours ?? presetH ?? 1);
  const [manualMinutes, setManualMinutes] = useState(initial?.manualMinutes ?? presetM ?? 0);
  const [types, setTypes] = useState<Option[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [ministryTypeId, setMinistryTypeId] = useState(initial?.ministryTypeId ?? "");
  const [studies, setStudies] = useState<string[]>(
    initial && initial.didStudy ? initial.personIds : []
  );
  const [visits, setVisits] = useState<string[]>(
    initial && !initial.didStudy && initial.didVisit ? initial.personIds : []
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tRes, pRes] = await Promise.all([fetch("/api/ministry-types"), fetch("/api/persons")]);
        const tData = await tRes.json().catch(() => ({}));
        const pData = await pRes.json().catch(() => ({}));
        if (!alive) return;
        const t: Option[] = (tData.types ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name }));
        const p: PersonOption[] = (pData.people ?? []).map(
          (x: { id: string; firstName: string; lastName?: string | null }) => ({
            id: x.id,
            label: `${x.firstName}${x.lastName ? ` ${x.lastName}` : ""}`,
          })
        );
        setTypes(t);
        setPeople(p);
        if (!initial) {
          const def = (tData.types ?? []).find((x: { isDefault?: boolean }) => x.isDefault) ?? tData.types?.[0];
          if (def) setMinistryTypeId(def.id);
        }
      } catch {
        if (alive) setError("No se pudieron cargar los datos. Reintentá.");
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [initial]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (studies.some((s) => !s)) {
      setError("Cada estudio necesita su estudiante asignado.");
      return;
    }
    setLoading(true);
    const personIds = [...studies, ...visits.filter(Boolean)];
    const res = await fetch(editing ? `/api/records/${initial.id}` : "/api/records", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        startMinute: mode === "auto" ? toMinutes(start) : null,
        endMinute: mode === "auto" ? toMinutes(end) : null,
        manualHours: mode === "manual" ? manualHours : null,
        manualMinutes: mode === "manual" ? manualMinutes : null,
        ministryTypeId,
        didStudy: studies.length > 0,
        didVisit: visits.length > 0,
        personIds,
        notes: notes || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar.");
      return;
    }
    toast(editing ? "Cambios guardados" : "Actividad guardada");
    if (onSaved) {
      onSaved();
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  if (!ready) {
    return <p className="py-6 text-center text-sm text-muted">Cargando…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {!editing && (
        <Stopwatch
          onApply={(h, m) => {
            setManualHours(h);
            setManualMinutes(m);
            setMode("manual");
          }}
        />
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Fecha</span>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
        />
      </label>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Modo de carga">
        {(["auto", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`min-h-[48px] rounded-md border px-3 py-2 text-sm transition-transform active:scale-[0.98] ${
              mode === m ? "border-primary bg-primary font-medium text-on-primary" : "border-line bg-surface"
            }`}
          >
            {m === "auto" ? "Inicio / Fin" : "Horas manual"}
          </button>
        ))}
      </div>

      {mode === "auto" ? (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium" id="lbl-inicio">Hora de inicio</span>
            <ClockPicker value={start} onChange={setStart} />
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium" id="lbl-fin">Hora de fin</span>
            <ClockPicker value={end} onChange={setEnd} />
          </div>
        </div>
      ) : (
        <div className="flex gap-2" role="group" aria-label="Carga manual de horas">
          <WheelPicker
            label="Horas"
            values={Array.from({ length: 25 }, (_, i) => i)}
            value={manualHours}
            onChange={setManualHours}
            format={(v) => String(v).padStart(2, "0")}
          />
          <WheelPicker
            label="Minutos"
            values={[0, 15, 30, 45]}
            value={manualMinutes}
            onChange={setManualMinutes}
            format={(v) => String(v).padStart(2, "0")}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5 text-sm">
        <label htmlFor="ministry-type" className="font-medium">Tipo de ministerio</label>
        <select
          id="ministry-type"
          value={ministryTypeId}
          onChange={(e) => setMinistryTypeId(e.target.value)}
          className={inputCls}
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted">
          ¿Otras formas de ministerio? Habilitálas u ocultalas en{" "}
          <Link href="/configuracion" className="text-primary underline">
            Configuración
          </Link>
          .
        </p>
      </div>

      <StepperRows
        title="Estudios bíblicos"
        rows={studies}
        setRows={setStudies}
        people={people}
        required
      />
      <StepperRows
        title="Visitas"
        rows={visits}
        setRows={setVisits}
        people={people}
        required={false}
      />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Notas <span className="font-normal text-muted">(opcional)</span></span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputCls}
        />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Guardando…" : editing ? "Guardar cambios" : "Guardar actividad"}
      </button>
      {editing && onDelete && (
        confirmingDelete ? (
          <div className="flex flex-col gap-2 rounded-md bg-pale-red p-3">
            <p className="text-sm font-medium text-pale-red-ink">¿Eliminar este registro? No se puede deshacer.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2 text-sm transition-transform active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  const res = await fetch(`/api/records/${initial.id}`, { method: "DELETE" });
                  setLoading(false);
                  if (!res.ok) {
                    setError("No se pudo eliminar.");
                    setConfirmingDelete(false);
                    return;
                  }
                  toast("Registro eliminado");
                  onDelete();
                }}
                className="min-h-[48px] rounded-md bg-pale-red-ink px-4 py-2 text-sm font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-muted transition-transform active:scale-[0.98]"
          >
            Eliminar registro
          </button>
        )
      )}
    </form>
  );
}

function StepperRows({
  title,
  rows,
  setRows,
  people,
  required,
}: {
  title: string;
  rows: string[];
  setRows: (r: string[]) => void;
  people: PersonOption[];
  required: boolean;
}) {
  function add() {
    if (rows.length >= 10) return;
    setRows([...rows, ""]);
  }
  function sub() {
    setRows(rows.slice(0, -1));
  }
  return (
    <div role="group" aria-label={title} className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {title}
          {required && rows.length > 0 && <span className="text-pale-red-ink"> *</span>}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={sub}
            disabled={rows.length === 0}
            aria-label={`Quitar ${title.toLowerCase()}`}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-line text-lg transition-transform active:scale-95 disabled:opacity-40"
          >
            −
          </button>
          <span className="w-6 text-center font-sans text-xl tabular-nums" aria-live="polite">
            {rows.length}
          </span>
          <button
            type="button"
            onClick={add}
            disabled={rows.length >= 10}
            aria-label={`Agregar ${title.toLowerCase()}`}
            className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-lg text-on-primary transition-transform active:scale-95 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {rows.map((pid, i) => (
            <label key={i} className="flex flex-col gap-1 text-sm">
              <span className="text-muted">
                {title.replace(/s$/, "")} {i + 1}
                {required && <span className="text-pale-red-ink"> *</span>}
                {!required && <span> (opcional)</span>}
              </span>
              <select
                value={pid}
                onChange={(e) => setRows(rows.map((r, j) => (j === i ? e.target.value : r)))}
                required={required}
                className={inputCls}
              >
                <option value="">{required ? "Seleccionar estudiante…" : "Sin asignar"}</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {people.length === 0 && (
            <p className="text-sm text-muted">
              Todavía no hay personas cargadas.{" "}
              <Link href="/personas" className="text-primary underline">
                Agregar en Personas
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}
