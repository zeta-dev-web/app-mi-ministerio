"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "../components/toast";

type PersonStatus = "revisita" | "curso" | "no_en_casa" | "no_visitar" | "archivado";

type Person = {
  id: string;
  firstName: string;
  lastName: string | null;
  territory: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  age: number | null;
  notes: string | null;
  status: PersonStatus | string;
  language: string | null;
  firstContactDate: string | null;
  studyPublication: string | null;
  studyLesson: number | null;
  studyTotalLessons: number | null;
  nextVisitDate: string | null;
  nextVisitTime: string | null;
  nextTopic: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Tab = "ACTIVE" | "ARCHIVED";

const STUDY_PUBLICATIONS = [
  "Disfrute de la vida para siempre",
  "Disfrute de la vida para siempre (folleto)",
  "La Biblia",
  "Otra publicación",
];

const inputCls =
  "min-h-[48px] w-full rounded-md border border-line bg-surface px-3 py-2 text-base placeholder:text-muted";

const STATUS_LABEL: Record<string, string> = {
  revisita: "Revisita",
  curso: "Curso",
  no_en_casa: "No en casa",
  no_visitar: "No visitar",
  archivado: "Archivada",
};

const STATUS_PILL: Record<string, string> = {
  revisita: "bg-sky-100 text-sky-800",
  curso: "bg-emerald-100 text-emerald-800",
  no_en_casa: "bg-amber-100 text-amber-800",
  no_visitar: "bg-rose-100 text-rose-800",
  archivado: "bg-stone-200 text-stone-600",
};

const STATUS_OPTIONS: { value: PersonStatus; label: string }[] = [
  { value: "revisita", label: "Revisita" },
  { value: "curso", label: "Curso" },
  { value: "no_en_casa", label: "No en casa" },
  { value: "no_visitar", label: "No visitar" },
];

function statusPill(status: string) {
  return STATUS_PILL[status] ?? "bg-stone-200 text-stone-600";
}

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

/** Normaliza fecha ISO/Date a "AAAA-MM-DD" para <input type="date">. */
function toDateInput(v: string | null | undefined): string {
  if (!v) return "";
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

type Draft = {
  firstName: string;
  lastName: string;
  territory: string;
  address: string;
  phone: string;
  email: string;
  age: number | null;
  notes: string;
  status: PersonStatus;
  language: string;
  firstContactDate: string;
  studyPublication: string;
  studyLesson: number | null;
  studyTotalLessons: number | null;
  nextVisitDate: string;
  nextVisitTime: string;
  nextTopic: string;
  latitude: number | null;
  longitude: number | null;
};

const EMPTY: Draft = {
  firstName: "",
  lastName: "",
  territory: "",
  address: "",
  phone: "",
  email: "",
  age: null,
  notes: "",
  status: "revisita",
  language: "Español",
  firstContactDate: "",
  studyPublication: "",
  studyLesson: null,
  studyTotalLessons: 60,
  nextVisitDate: "",
  nextVisitTime: "",
  nextTopic: "",
  latitude: null,
  longitude: null,
};

function fullName(p: Pick<Person, "firstName" | "lastName">) {
  return `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`;
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

export function PersonasClient() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("ACTIVE");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    null | { mode: "create" } | { mode: "edit"; person: Person } | { mode: "visit"; person: Person }
  >(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [viewPerson, setViewPerson] = useState<Person | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const load = useCallback(async (t: Tab, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({ status: t });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/persons?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    setPeople(data.people ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(tab, query), query ? 300 : 0);
    return () => clearTimeout(id);
  }, [tab, query, load]);

  function openCreate() {
    setDraft(EMPTY);
    setError(null);
    setGeoMsg(null);
    setModal({ mode: "create" });
  }

  function openEdit(person: Person) {
    setDraft({
      firstName: person.firstName,
      lastName: person.lastName ?? "",
      territory: person.territory ?? "",
      address: person.address ?? "",
      phone: person.phone ?? "",
      email: person.email ?? "",
      age: person.age,
      notes: person.notes ?? "",
      status: (STATUS_OPTIONS.some((o) => o.value === person.status) ? person.status : "revisita") as PersonStatus,
      language: person.language ?? "Español",
      firstContactDate: toDateInput(person.firstContactDate),
      studyPublication: person.studyPublication ?? "",
      studyLesson: person.studyLesson,
      studyTotalLessons: person.studyTotalLessons ?? 60,
      nextVisitDate: toDateInput(person.nextVisitDate),
      nextVisitTime: person.nextVisitTime ?? "",
      nextTopic: person.nextTopic ?? "",
      latitude: person.latitude,
      longitude: person.longitude,
    });
    setError(null);
    setGeoMsg(null);
    setModal({ mode: "edit", person });
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openVisit(person: Person) {
    setDraft((d) => ({
      ...d,
      nextVisitDate: toDateInput(person.nextVisitDate),
      nextVisitTime: person.nextVisitTime ?? "",
      nextTopic: person.nextTopic ?? "",
    }));
    setError(null);
    setMenuId(null);
    setModal({ mode: "visit", person });
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeoMsg("Tu navegador no permite obtener la ubicación.");
      return;
    }
    setGeoLoading(true);
    setGeoMsg("Obteniendo ubicación…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeoLoading(false);
        setGeoMsg(null);
        setDraft((d) => ({ ...d, latitude: p.coords.latitude, longitude: p.coords.longitude }));
      },
      (err) => {
        setGeoLoading(false);
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? "Permiso denegado. Activá la ubicación en tu navegador para guardarla."
            : "No se pudo obtener la ubicación. Reintentá."
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.firstName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setError(null);
    setSaving(true);
    const body = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim() || null,
      territory: draft.territory.trim() || null,
      address: draft.address.trim() || null,
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      age: draft.age,
      notes: draft.notes.trim() || null,
      status: draft.status,
      language: draft.language.trim() || null,
      firstContactDate: draft.firstContactDate || null,
      studyPublication: draft.status === "curso" ? draft.studyPublication.trim() || null : null,
      studyLesson: draft.status === "curso" ? draft.studyLesson : null,
      studyTotalLessons: draft.status === "curso" ? (draft.studyTotalLessons ?? 60) : null,
      nextVisitDate: draft.nextVisitDate || null,
      nextVisitTime: draft.nextVisitTime.trim() || null,
      nextTopic: draft.nextTopic.trim() || null,
      latitude: draft.latitude,
      longitude: draft.longitude,
    };
    const isEdit = modal?.mode === "edit";
    const res = await fetch(isEdit ? `/api/persons/${(modal as { person: Person }).person.id}` : "/api/persons", {
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
    toast(isEdit ? "Persona actualizada" : "Persona agregada");
    setModal(null);
    load(tab, query);
  }

  async function onVisitSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || modal.mode !== "visit") return;
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/persons/${modal.person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nextVisitDate: draft.nextVisitDate || null,
        nextVisitTime: draft.nextVisitTime || null,
        nextTopic: draft.nextTopic.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar la próxima visita.");
      return;
    }
    toast("Próxima visita guardada");
    setModal(null);
    load(tab, query);
  }

  async function toggleArchive(person: Person) {
    setSaving(true);
    const res = await fetch(`/api/persons/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: person.status === "archivado" ? "revisita" : "archivado" }),
    });
    setSaving(false);
    if (!res.ok) return;
    toast(person.status === "archivado" ? "Persona recuperada" : "Persona archivada");
    setModal(null);
    setMenuId(null);
    load(tab, query);
  }

  async function remove(id: string) {
    setSaving(true);
    const res = await fetch(`/api/persons/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo eliminar.");
      return;
    }
    toast("Persona eliminada");
    setMenuId(null);
    setConfirmingDelete(false);
    load(tab, query);
  }

  const isEdit = modal?.mode === "edit";
  const editPerson = isEdit ? (modal as { person: Person }).person : null;
  const hasCoords = draft.latitude != null && draft.longitude != null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-fluid-3xl text-balance tracking-tight">Personas interesadas</h1>
        <button type="button" onClick={openCreate} className="hidden min-h-11 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-strong md:flex">+ Agregar persona</button>
      </div>

      <div className="flex gap-6 border-b border-line text-sm" role="tablist" aria-label="Estado">
        {(["ACTIVE", "ARCHIVED"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-[48px] px-1 font-medium transition-colors ${
              tab === t ? "border-b-2 border-primary text-primary" : "text-muted"
            }`}
          >
            {t === "ACTIVE" ? "Activos" : "Archivados"}
          </button>
        ))}
      </div>

      <label className="relative block">
        <span className="sr-only">Buscar por nombre, dirección o notas</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, dirección, notas…"
          className={`${inputCls} pl-10`}
        />
      </label>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando…</p>
      ) : people.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
          </svg>
          <p className="text-lg font-medium">Sin Personas Interesadas</p>
          <p className="text-sm text-muted">
            {tab === "ACTIVE" ? "Agregá tu primera persona interesada" : "No hay personas archivadas"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {people.map((p, i) => {
            const menuOpen = menuId === p.id;
            return (
              <div
                key={p.id}
                className="reveal relative flex min-h-[60px] w-full items-center gap-2 rounded-xl border border-line bg-surface p-3 transition-transform active:scale-[0.99]"
                style={{ "--index": Math.min(i, 8) } as React.CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => setViewPerson(p)}
                  aria-label={`Ver ${fullName(p)}`}
                  className="flex min-w-0 flex-1 items-center gap-2 truncate py-2 text-left font-medium"
                >
                  <span className="truncate">{fullName(p)}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusPill(String(p.status))}`}>
                    {statusLabel(String(p.status))}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuId(menuOpen ? null : p.id);
                    setConfirmingDelete(false);
                  }}
                  aria-label={`Opciones de ${fullName(p)}`}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted transition-colors hover:text-ink"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="12" cy="19" r="1.8" />
                  </svg>
                </button>
                {menuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Cerrar menú"
                      onClick={() => {
                        setMenuId(null);
                        setConfirmingDelete(false);
                      }}
                      className="fixed inset-0 z-20 cursor-default bg-transparent"
                    />
                    <div
                      role="menu"
                      aria-label={`Opciones de ${fullName(p)}`}
                      className="absolute top-full right-2 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
                    >
                      {error && (
                        <p role="alert" className="border-b border-line bg-pale-red px-4 py-2 text-xs text-pale-red-ink">
                          {error}
                        </p>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuId(null);
                          setViewPerson(p);
                        }}
                        className="flex min-h-[48px] w-full items-center px-4 text-sm font-medium transition-colors hover:bg-canvas"
                      >
                        Ver persona
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openVisit(p)}
                        className="flex min-h-[48px] w-full items-center border-t border-line px-4 text-sm font-medium transition-colors hover:bg-canvas"
                      >
                        Cargar próxima visita
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuId(null);
                          openEdit(p);
                        }}
                        className="flex min-h-[48px] w-full items-center border-t border-line px-4 text-sm font-medium transition-colors hover:bg-canvas"
                      >
                        Editar persona
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={saving}
                        onClick={() => toggleArchive(p)}
                        className="flex min-h-[48px] w-full items-center border-t border-line px-4 text-sm font-medium transition-colors hover:bg-canvas disabled:opacity-60"
                      >
                        {p.status === "archivado" ? "Recuperar persona" : "Archivar persona"}
                      </button>
                      {confirmingDelete ? (
                        <div className="border-t border-line bg-pale-red p-2">
                          <p className="px-2 py-1 text-xs font-medium text-pale-red-ink">
                            ¿Eliminar a {fullName(p)}?
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmingDelete(false)}
                              className="min-h-[44px] rounded-md border border-line bg-surface px-2 text-sm"
                            >
                              No
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => remove(p.id)}
                              className="min-h-[44px] rounded-md bg-pale-red-ink px-2 text-sm font-medium text-white disabled:opacity-60"
                            >
                              Sí
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setConfirmingDelete(true)}
                          className="flex min-h-[48px] w-full items-center border-t border-line px-4 text-sm font-medium text-pale-red-ink transition-colors hover:bg-canvas"
                        >
                          Eliminar persona
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={openCreate}
        aria-label="Agregar persona interesada"
        className="fixed right-4 bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-primary text-on-primary shadow-sm transition-transform active:scale-95 md:hidden"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {modal?.mode === "visit" && (
        <Modal title="Próxima visita" onClose={() => setModal(null)}>
          <form onSubmit={onVisitSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-muted">{fullName(modal.person)}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Fecha</span>
                <input
                  type="date"
                  lang="es-AR"
                  value={draft.nextVisitDate}
                  onChange={(e) => set("nextVisitDate", e.target.value)}
                  className={inputCls}
                />
                <span className="text-xs text-muted">Formato: dd/mm/aaaa</span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Hora</span>
                <input
                  type="time"
                  lang="es-AR"
                  value={draft.nextVisitTime}
                  onChange={(e) => set("nextVisitTime", e.target.value)}
                  className={inputCls}
                />
                <span className="text-xs text-muted">Formato: HH:MM</span>
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Tema</span>
              <input
                value={draft.nextTopic}
                onChange={(e) => set("nextTopic", e.target.value)}
                maxLength={300}
                className={inputCls}
                placeholder="Tema para la próxima visita"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2.5 text-sm transition-transform active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal && modal.mode !== "visit" && (
        <Modal title={isEdit ? "Editar persona" : "Agregar Persona Interesada"} onClose={() => setModal(null)}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Nombre *</span>
                <input value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} required maxLength={80} className={inputCls} placeholder="Nombre" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Apellido</span>
                <input value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} maxLength={80} className={inputCls} placeholder="Apellido" />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Territorio</span>
              <input value={draft.territory} onChange={(e) => set("territory", e.target.value)} maxLength={80} className={inputCls} placeholder="Territorio" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Dirección</span>
              <input value={draft.address} onChange={(e) => set("address", e.target.value)} maxLength={200} className={inputCls} placeholder="Dirección" />
            </label>
            {hasCoords ? (
              <div className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-sm">
                <span className="flex-1 tabular-nums">
                  📍 {draft.latitude?.toFixed(5)}, {draft.longitude?.toFixed(5)}
                </span>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, latitude: null, longitude: null }))}
                  aria-label="Quitar ubicación"
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-muted hover:text-ink"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={locate}
                disabled={geoLoading}
                className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {geoLoading ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}
              </button>
            )}
            {geoMsg && <p className="text-xs text-muted">{geoMsg}</p>}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Teléfono</span>
                <input value={draft.phone} onChange={(e) => set("phone", e.target.value)} type="tel" maxLength={40} className={inputCls} placeholder="Teléfono" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Edad</span>
                <input
                  value={draft.age ?? ""}
                  onChange={(e) => set("age", e.target.value === "" ? null : Number(e.target.value))}
                  type="number"
                  min={0}
                  max={130}
                  className={inputCls}
                  placeholder="Edad"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Correo electrónico</span>
              <input value={draft.email} onChange={(e) => set("email", e.target.value)} type="email" maxLength={120} className={inputCls} placeholder="Email" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Idioma</span>
              <input value={draft.language} onChange={(e) => set("language", e.target.value)} maxLength={60} className={inputCls} placeholder="Español" />
            </label>

            <div className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium" id="person-status-label">Estado</span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="person-status-label">
                {STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set("status", o.value)}
                    aria-pressed={draft.status === o.value}
                    className={`min-h-[48px] rounded-md border px-3 py-2 text-sm transition-transform active:scale-[0.98] ${
                      draft.status === o.value
                        ? "border-primary bg-primary font-medium text-on-primary"
                        : "border-line bg-surface"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {draft.status === "curso" && (
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Publicación de estudio</span>
                  <input
                    list="study-publications"
                    value={draft.studyPublication}
                    onChange={(e) => set("studyPublication", e.target.value)}
                    maxLength={120}
                    className={inputCls}
                    placeholder="Disfrute de la vida para siempre"
                  />
                  <datalist id="study-publications">
                    {STUDY_PUBLICATIONS.map((publication) => <option key={publication} value={publication} />)}
                  </datalist>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">Lección actual</span>
                    <input
                      value={draft.studyLesson ?? ""}
                      onChange={(e) => set("studyLesson", e.target.value === "" ? null : Number(e.target.value))}
                      type="number"
                      min={0}
                      className={inputCls}
                      placeholder="0"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">Total de lecciones</span>
                    <input
                      value={draft.studyTotalLessons ?? ""}
                      onChange={(e) => set("studyTotalLessons", e.target.value === "" ? null : Number(e.target.value))}
                      type="number"
                      min={1}
                      className={inputCls}
                      placeholder="60"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-3">
              <p className="text-sm font-medium">Próxima visita</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Fecha</span>
                  <input
                    type="date"
                    value={draft.nextVisitDate}
                    onChange={(e) => set("nextVisitDate", e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Hora</span>
                  <input
                    type="time"
                    value={draft.nextVisitTime}
                    onChange={(e) => set("nextVisitTime", e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Tema</span>
                <input value={draft.nextTopic} onChange={(e) => set("nextTopic", e.target.value)} maxLength={300} className={inputCls} placeholder="Tema para la próxima visita" />
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Fecha de primer contacto</span>
              <input
                type="date"
                value={draft.firstContactDate}
                onChange={(e) => set("firstContactDate", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Notas</span>
              <textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputCls} placeholder="Notas" />
            </label>
            {error && (
              <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
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
            {isEdit && editPerson && (
              <button
                type="button"
                disabled={saving}
                onClick={() => toggleArchive(editPerson)}
                className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-muted transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {editPerson.status === "archivado" ? "Recuperar persona" : "Archivar persona"}
              </button>
            )}
          </form>
        </Modal>
      )}

      {viewPerson && (
        <Modal title={fullName(viewPerson)} onClose={() => setViewPerson(null)}>
          {viewPerson.nextVisitDate ? (
            <section className="mb-4 rounded-xl border border-primary/20 bg-primary-soft p-4" aria-label="Próxima visita">
              <p className="text-xs font-semibold tracking-[0.05em] text-primary uppercase">Próxima visita</p>
              <p className="mt-1 font-medium text-primary-ink">
                {toDateInput(viewPerson.nextVisitDate)}
                {viewPerson.nextVisitTime ? ` · ${viewPerson.nextVisitTime}` : ""}
              </p>
              {viewPerson.nextTopic ? <p className="mt-1 text-sm text-muted">{viewPerson.nextTopic}</p> : null}
            </section>
          ) : null}
          <dl className="flex flex-col gap-2 text-sm">
            {[
              ["Apellido", viewPerson.lastName],
              ["Territorio", viewPerson.territory],
              ["Dirección", viewPerson.address],
              ["Teléfono", viewPerson.phone],
              ["Correo electrónico", viewPerson.email],
              ["Edad", viewPerson.age != null ? String(viewPerson.age) : null],
              ["Idioma", viewPerson.language],
              ["Fecha de primer contacto", toDateInput(viewPerson.firstContactDate) || null],
              ["Estado", statusLabel(String(viewPerson.status))],
              ...(String(viewPerson.status) === "curso"
                ? [
                    ["Publicación de estudio", viewPerson.studyPublication] as [string, string | null],
                    ["Lección actual", viewPerson.studyLesson != null ? String(viewPerson.studyLesson) : null] as [string, string | null],
                    ["Total de lecciones", viewPerson.studyTotalLessons != null ? String(viewPerson.studyTotalLessons) : null] as [string, string | null],
                  ]
                : []),
              ["Próxima visita", toDateInput(viewPerson.nextVisitDate) || null],
              ["Hora de visita", viewPerson.nextVisitTime],
              ["Tema próximo", viewPerson.nextTopic],
              [
                "Ubicación",
                viewPerson.latitude != null && viewPerson.longitude != null
                  ? `${viewPerson.latitude.toFixed(5)}, ${viewPerson.longitude.toFixed(5)}`
                  : null,
              ],
              ["Notas", viewPerson.notes],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-line pb-2 last:border-0">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          {viewPerson.latitude != null && viewPerson.longitude != null ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${viewPerson.latitude},${viewPerson.longitude}`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-md border border-primary bg-primary-soft px-4 py-2.5 text-sm font-medium text-primary-ink transition-colors hover:bg-primary hover:text-on-primary"
            >
              Abrir en Google Maps
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => { openEdit(viewPerson); setViewPerson(null); setMenuId(null); }}
            className="mt-4 min-h-[48px] w-full rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98]"
          >
            Editar persona
          </button>
        </Modal>
      )}
    </div>
  );
}
