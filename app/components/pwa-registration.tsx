"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PwaUpdate {
  updateAvailable: boolean;
  applyUpdate: () => void;
}

/**
 * Registra el service worker push-only (/sw.js, scope "/") y detecta
 * actualizaciones en espera. Nunca pide permisos de notificación.
 */
export function usePwaUpdate(): PwaUpdate {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let reg: ServiceWorkerRegistration | null = null;

    const markUpdateReady = (candidate: ServiceWorkerRegistration | null) => {
      if (cancelled) return;
      // Hay una versión nueva instalada y esta pestaña sigue controlada por la anterior.
      if (candidate?.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
      }
    };

    const handleControllerChange = () => {
      // Recarga una sola vez cuando la nueva versión toma el control.
      if (reloadedRef.current) return;
      reloadedRef.current = true;
      window.location.reload();
    };

    const handleUpdateFound = () => {
      const installing = reg?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed") markUpdateReady(reg);
      });
    };

    const register = async () => {
      try {
        reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (cancelled) return;
        setRegistration(reg);
        markUpdateReady(reg);
        reg.addEventListener("updatefound", handleUpdateFound);
        try {
          await reg.update();
        } catch {
          // Fallo silencioso al buscar actualización (offline, etc.).
        }
        markUpdateReady(reg);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[pwa] no se pudo registrar el service worker", error);
        }
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    void register();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      reg?.removeEventListener("updatefound", handleUpdateFound);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }, [registration]);

  return { updateAvailable, applyUpdate };
}

/**
 * Montado una sola vez desde el layout raíz. Muestra un aviso discreto
 * ("Hay una actualización disponible" + botón Actualizar) solo cuando hay
 * una versión nueva esperando. No pide permisos ni muestra errores técnicos.
 */
export function PwaRegistration() {
  const { updateAvailable, applyUpdate } = usePwaUpdate();

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <div className="bg-surface border-line text-ink flex w-full max-w-md items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg">
        <p className="text-sm">Hay una actualización disponible</p>
        <button
          type="button"
          onClick={applyUpdate}
          className="bg-primary text-on-primary shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
