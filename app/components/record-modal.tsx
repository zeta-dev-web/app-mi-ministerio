"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RecordForm, type RecordInitial } from "../actividad/nueva/form";

export function ModalHost() {
  return (
    <Suspense>
      <ModalHostInner />
    </Suspense>
  );
}

function ModalHostInner() {
  const params = useSearchParams();
  return <RecordDialog key={params.get("editar") ?? (params.get("cargar") === "1" ? "create" : "closed")} />;
}

function RecordDialog() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const createOpen = params.get("cargar") === "1";
  const editId = params.get("editar");
  const timerMinutos = (() => {
    const n = Number(params.get("minutos"));
    return Number.isInteger(n) && n > 0 ? n : null;
  })();
  const open = createOpen || editId != null;
  const [initial, setInitial] = useState<RecordInitial | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("cargar");
    next.delete("editar");
    next.delete("minutos");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    if (editId == null) {
      return;
    }
    let alive = true;
    (async () => {
      const res = await fetch(`/api/records/${editId}`);
      const data = await res.json().catch(() => ({}));
      if (!alive) return;
      if (!res.ok || !data.record) {
        setLoadError(data.error ?? "No se pudo cargar el registro.");
        return;
      }
      const r = data.record;
      setInitial({
        id: r.id,
        date: r.date.slice(0, 10),
        startMinute: r.startMinute,
        endMinute: r.endMinute,
        manualHours: r.manualHours,
        manualMinutes: r.manualMinutes,
        ministryTypeId: r.ministryTypeId,
        didStudy: r.didStudy,
        didVisit: r.didVisit,
        personIds: (r.people ?? []).map((p: { personId: string }) => p.personId),
        notes: r.notes ?? "",
      });
    })();
    return () => {
      alive = false;
    };
  }, [editId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editId != null ? "Editar actividad" : "Agregar actividad"}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={close}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <div className="sheet-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-canvas sm:max-w-xl sm:rounded-xl sm:border sm:border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <p className="font-display text-2xl tracking-tight text-primary">
            {editId != null ? "Editar actividad" : "Agregar actividad"}
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar diálogo"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-line bg-surface transition-transform active:scale-[0.98]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
          {editId != null && initial == null ? (
            <p className="py-6 text-center text-sm text-muted">
              {loadError ?? "Cargando registro…"}
            </p>
          ) : (
            <RecordForm
              key={editId ?? `nuevo-${timerMinutos ?? 0}`}
              initial={initial ?? undefined}
              presetMinutes={timerMinutos ?? undefined}
              onSaved={() => {
                if (timerMinutos != null) {
                  fetch("/api/timer", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "reset" }),
                  }).catch(() => {});
                }
                close();
                router.refresh();
              }}
              onDelete={() => {
                close();
                router.refresh();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
