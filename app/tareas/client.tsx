"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REMINDER_OPTIONS, TASK_TYPE_SUGGESTIONS } from "@/lib/validations/task";
import { minutesToTimeString } from "@/lib/ministry";
import { useToast } from "../components/toast";

type Task = {
  id: string;
  type: string;
  topic: string | null;
  date: string;
  timeMinute: number | null;
  notes: string | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number | null;
  reminderAt: string | null;
  status: "PENDING" | "DONE";
};

type Draft = {
  type: string;
  topic: string;
  date: string;
  hasTime: boolean;
  time: string;
  notes: string;
  reminderEnabled: boolean;
  reminderMode: "relative" | "custom";
  reminderMinutesBefore: number;
  customReminderDate: string;
  customReminderTime: string;
};

const inputCls =
  "min-h-[48px] w-full rounded-md border border-line bg-surface px-3 py-2 text-base placeholder:text-muted";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateLabel(iso: string): string {
  const today = todayStr();
  if (iso === today) return "Hoy";
  const t = new Date(today + "T12:00:00");
  const d = new Date(iso + "T12:00:00");
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function toMinutes(hhmm: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  return h * 60 + m;
}

function localReminderParts(value: string | null): { date: string; time: string } {
  if (!value) return { date: "", time: "19:00" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: "", time: "19:00" };
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

function reminderIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 cursor-default bg-black/40" />
      <div className="sheet-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-canvas sm:max-w-lg sm:rounded-xl sm:border sm:border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <p className="font-display text-2xl tracking-tight">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-line bg-surface transition-transform active:scale-[0.98]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">{children}</div>
      </div>
    </div>
  );
}

export function TareasClient() {
  const toast = useToast();
  const [tab, setTab] = useState<"PENDING" | "DONE">("PENDING");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | { mode: "create" } | { mode: "edit"; task: Task }>(null);
  const [draft, setDraft] = useState<Draft>({
    type: "",
    topic: "",
    date: todayStr(),
    hasTime: false,
    time: "19:00",
    notes: "",
    reminderEnabled: false,
    reminderMode: "relative",
    reminderMinutesBefore: 60,
    customReminderDate: "",
    customReminderTime: "19:00",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const load = useCallback(async (status: "PENDING" | "DONE") => {
    const res = await fetch(`/api/tasks?status=${status}`);
    const data = await res.json().catch(() => ({}));
    setTasks((data.tasks ?? []).map((t: Task & { date: string }) => ({ ...t, date: t.date.slice(0, 10) })));
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/tasks?status=${tab}`, { signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error("No se pudieron cargar las asignaciones."); return res.json(); })
      .then(data => {
        setTasks((data.tasks ?? []).map((t: Task) => ({ ...t, date: t.date.slice(0, 10) })));
        setLoading(false);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setError(error.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [tab]);

  // Deep link §17: /tareas?task=<id> abre el modal de edición. La API
  // verifica ownership (404 si no es del usuario). El param se limpia al
  // cerrar el modal (closeModal) sin recargar.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const id = new URLSearchParams(window.location.search).get("task");
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`);
        if (cancelled) return;
        if (!res.ok) {
          toast("La asignación ya no está disponible.", "info");
          cleanTaskParam();
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!data.task || cancelled) return;
        openEdit({ ...data.task, date: String(data.task.date).slice(0, 10) });
      } catch {
        if (!cancelled) {
          toast("No se pudo abrir la asignación.", "info");
          cleanTaskParam();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Se ejecuta una sola vez al montar (guardado por ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanTaskParam() {
    if (new URLSearchParams(window.location.search).has("task")) {
      window.history.replaceState(null, "", "/tareas");
    }
  }

  function closeModal() {
    setModal(null);
    setConfirmingDelete(false);
    cleanTaskParam();
  }

  function openCreate() {
    setDraft({
      type: "",
      topic: "",
      date: todayStr(),
      hasTime: false,
      time: "19:00",
      notes: "",
      reminderEnabled: false,
      reminderMode: "relative",
      reminderMinutesBefore: 60,
      customReminderDate: "",
      customReminderTime: "19:00",
    });
    setError(null);
    setConfirmingDelete(false);
    setModal({ mode: "create" });
  }

  function openEdit(task: Task) {
    setDraft({
      type: task.type,
      topic: task.topic ?? "",
      date: task.date.slice(0, 10),
      hasTime: task.timeMinute != null,
      time: task.timeMinute != null ? minutesToTimeString(task.timeMinute) : "19:00",
      notes: task.notes ?? "",
      reminderEnabled: task.reminderEnabled,
      reminderMode: task.reminderAt ? "custom" : "relative",
      reminderMinutesBefore: task.reminderMinutesBefore ?? 60,
      customReminderDate: localReminderParts(task.reminderAt).date,
      customReminderTime: localReminderParts(task.reminderAt).time,
    });
    setError(null);
    setConfirmingDelete(false);
    setModal({ mode: "edit", task });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.type.trim()) {
      setError("El tipo es obligatorio.");
      return;
    }
    if (draft.reminderEnabled && !draft.hasTime && draft.reminderMode === "relative") {
      setError("Sin hora concreta no se puede usar recordatorio relativo: agregá una hora a la asignación o elegí “Personalizar” con fecha y hora propias.");
      return;
    }
    if (draft.reminderEnabled && draft.reminderMode === "custom") {
      const iso = reminderIso(draft.customReminderDate, draft.customReminderTime);
      if (!iso) {
        setError("Elegí una fecha y hora válidas para el recordatorio.");
        return;
      }
      if (new Date(iso).getTime() <= Date.now()) {
        setError("El recordatorio personalizado debe estar en el futuro.");
        return;
      }
    }
    setError(null);
    setSaving(true);
    const body = {
      type: draft.type.trim(),
      topic: draft.topic.trim() || null,
      date: draft.date,
      timeMinute: draft.hasTime ? toMinutes(draft.time) : null,
      notes: draft.notes.trim() || null,
      reminderEnabled: draft.reminderEnabled,
      reminderMinutesBefore: draft.reminderEnabled && draft.reminderMode === "relative" ? draft.reminderMinutesBefore : null,
      reminderAt: draft.reminderEnabled && draft.reminderMode === "custom"
        ? reminderIso(draft.customReminderDate, draft.customReminderTime)
        : null,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const isEdit = modal?.mode === "edit";
    const res = await fetch(isEdit ? `/api/tasks/${(modal as { task: Task }).task.id}` : "/api/tasks", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar.");
      return;
    }
    toast(isEdit ? "Asignación actualizada" : "Asignación agregada");
    closeModal();
    load(tab);
  }

  async function toggleDone(task: Task) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: task.status === "PENDING" ? "DONE" : "PENDING" }),
    });
    if (!res.ok) return;
    toast(task.status === "PENDING" ? "Asignación completada" : "Asignación pendiente");
    load(tab);
  }

  async function remove(task: Task) {
    setSaving(true);
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) return;
    toast("Asignación eliminada");
    closeModal();
    load(tab);
  }

  const today = todayStr();
  const overdue = tasks.filter((t) => t.status === "PENDING" && t.date < today);
  const todayTasks = tasks.filter((t) => t.status === "PENDING" && t.date === today);
  const upcoming = tasks.filter((t) => t.status === "PENDING" && t.date > today);
  const done = tasks.filter((t) => t.status === "DONE");

  const isEdit = modal?.mode === "edit";
  const editTask = isEdit ? (modal as { task: Task }).task : null;

  function TaskRow({ task }: { task: Task }) {
    const late = task.status === "PENDING" && task.date < today;
    return (
      <div className="reveal flex items-center gap-3 rounded-xl border border-line bg-surface p-3" style={{ "--index": 0 } as React.CSSProperties}>
        <button
          type="button"
          onClick={() => toggleDone(task)}
          aria-label={task.status === "PENDING" ? `Marcar como hecha: ${task.type}` : `Volver a pendiente: ${task.type}`}
          aria-pressed={task.status === "DONE"}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-transform active:scale-95 ${
            task.status === "DONE" ? "border-primary bg-primary text-on-primary" : "border-line"
          }`}
        >
          {task.status === "DONE" && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </button>
        <button type="button" onClick={() => openEdit(task)} className="flex min-w-0 flex-1 flex-col text-left">
          <span className={`truncate font-medium ${task.status === "DONE" ? "text-muted line-through" : ""}`}>
            {task.type}
            {task.topic ? ` · ${task.topic}` : ""}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <span>{dateLabel(task.date)}</span>
            {task.timeMinute != null && <span>· {minutesToTimeString(task.timeMinute)}</span>}
            {task.reminderEnabled && (
              <span>
                · Recuerda {task.reminderAt
                  ? new Date(task.reminderAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                  : REMINDER_OPTIONS.find((o) => o.value === task.reminderMinutesBefore)?.label ?? ""}
              </span>
            )}
            {late && (
              <span className="rounded-full bg-pale-red px-2 py-0.5 text-xs font-medium tracking-[0.05em] text-pale-red-ink uppercase">
                Atrasada
              </span>
            )}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-fluid-3xl text-balance tracking-tight">Asignaciones</h1>
        <button type="button" onClick={openCreate} className="hidden min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-strong md:flex">+ Agregar asignación</button>
      </div>

      <div className="flex gap-6 border-b border-line text-sm" role="tablist" aria-label="Estado">
        {(["PENDING", "DONE"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => { if (t !== tab) { setLoading(true); setTab(t); } }}
            className={`min-h-[48px] px-1 font-medium transition-colors ${
              tab === t ? "border-b-2 border-primary text-primary" : "text-muted"
            }`}
          >
            {t === "PENDING" ? "Pendientes" : "Completadas"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando…</p>
      ) : tab === "PENDING" && tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted">
            <path d="M4 6l16 0M4 12l16 0M4 18l10 0" />
            <path d="M17 15l2 2 4-4M17 19l2 2 4-4" />
          </svg>
          <p className="text-lg font-medium">Sin asignaciones</p>
          <p className="max-w-xs text-sm text-muted">
            Añadí partes de las reuniones, salidas al servicio o la limpieza: aparecen acá y desaparecen al marcarlas.
          </p>
        </div>
      ) : tab === "DONE" && done.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Todavía no completaste asignaciones.</p>
      ) : tab === "PENDING" ? (
        <div className="flex flex-col gap-5">
          {overdue.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Atrasadas">
              <h2 className="text-xs font-medium tracking-[0.05em] text-pale-red-ink uppercase">Atrasadas</h2>
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </section>
          )}
          {todayTasks.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Hoy">
              <h2 className="text-xs font-medium tracking-[0.05em] text-muted uppercase">Hoy</h2>
              {todayTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </section>
          )}
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Próximas">
              <h2 className="text-xs font-medium tracking-[0.05em] text-muted uppercase">Próximas</h2>
              {upcoming.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {done.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={openCreate}
        aria-label="Añadir asignación"
        className="fixed right-4 bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-primary text-on-primary shadow-sm transition-transform active:scale-95 md:hidden"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {modal && (
        <Modal title={isEdit ? "Editar asignación" : "Añadir asignación"} onClose={closeModal}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Tipo *</span>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                required
                className={inputCls}
              >
                <option value="">Seleccionar tipo…</option>
                {TASK_TYPE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Tema</span>
              <input
                value={draft.topic}
                onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                maxLength={160}
                placeholder="p. ej. Imitemos su fe"
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Fecha</span>
                <input
                  type="date"
                  required
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className={inputCls}
                />
              </label>
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Hora</span>
                {draft.hasTime ? (
                  <input
                    type="time"
                    value={draft.time}
                    onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                    className={inputCls}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, hasTime: true })}
                    className="flex min-h-[48px] items-center rounded-md border border-line bg-surface px-3 text-muted"
                  >
                    Sin hora concreta
                  </button>
                )}
                {draft.hasTime && (
                  <button type="button" onClick={() => setDraft({ ...draft, hasTime: false })} className="text-left text-xs text-muted underline">
                    Quitar hora
                  </button>
                )}
              </div>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Notas</span>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={3}
                className={inputCls}
              />
            </label>
            <div className="flex min-h-[48px] items-center justify-between gap-3">
              <span className="text-sm font-medium">Recordatorio</span>
              <button
                type="button"
                role="switch"
                aria-checked={draft.reminderEnabled}
                aria-label="Recordatorio"
                onClick={() => setDraft({ ...draft, reminderEnabled: !draft.reminderEnabled })}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${draft.reminderEnabled ? "bg-primary" : "bg-line"}`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${draft.reminderEnabled ? "left-7" : "left-1"}`}
                />
              </button>
            </div>
            {draft.reminderEnabled && (
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Cuándo recordar</span>
                <select
                    value={draft.reminderMode === "custom" ? "custom" : String(draft.reminderMinutesBefore)}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setDraft({ ...draft, reminderMode: "custom" });
                      } else {
                        setDraft({ ...draft, reminderMode: "relative", reminderMinutesBefore: Number(e.target.value) });
                      }
                    }}
                    className={inputCls}
                  >
                    {REMINDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value === 60 ? "1 hora antes" : o.value === 1440 ? "1 día antes" : o.label}
                      </option>
                    ))}
                    <option value="custom">Personalizar</option>
                  </select>
                  {!draft.hasTime && draft.reminderMode === "relative" && (
                    <span className="text-xs text-muted">
                      Sin hora concreta: agregá una hora a la asignación o elegí “Personalizar” con fecha y hora propias.
                    </span>
                  )}
                </label>
                {draft.reminderMode === "custom" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="font-medium">Día del recordatorio</span>
                      <input
                        type="date"
                        lang="es-AR"
                        required
                        value={draft.customReminderDate}
                        onChange={(e) => setDraft({ ...draft, customReminderDate: e.target.value })}
                        className={inputCls}
                      />
                      <span className="text-xs text-muted">Formato local: dd/mm/aaaa</span>
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="font-medium">Hora del recordatorio</span>
                      <input
                        type="time"
                        lang="es-AR"
                        required
                        value={draft.customReminderTime}
                        onChange={(e) => setDraft({ ...draft, customReminderTime: e.target.value })}
                        className={inputCls}
                      />
                      <span className="text-xs text-muted">Formato local: HH:MM</span>
                    </label>
                  </div>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2.5 text-sm transition-transform active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
              >
                {saving ? "Guardando…" : isEdit ? "Guardar" : "Añadir"}
              </button>
            </div>
            {isEdit && editTask && (
              <div className="flex flex-col gap-2">
                <a
                  href={`/api/tasks/${editTask.id}/ics`}
                  className="flex min-h-[48px] items-center justify-center rounded-md border border-line bg-surface px-4 py-2.5 text-sm transition-transform active:scale-[0.98]"
                >
                  Añadir al calendario del teléfono
                </a>
                {confirmingDelete ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2 text-sm"
                    >
                      Conservar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => remove(editTask)}
                      className="min-h-[48px] rounded-md bg-pale-red-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Sí, eliminar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="min-h-[48px] rounded-md px-4 py-2.5 text-sm text-muted"
                  >
                    Eliminar asignación
                  </button>
                )}
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
