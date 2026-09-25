"use client";

import { useCallback, useEffect, useState } from "react";

// Tarjeta "Notificaciones" de Configuración (FASE 2, §12 del plan).
// Representa el dispositivo/navegador ACTUAL, no un interruptor global.
// El permiso solo se solicita tras clic explícito en "Activar" (nunca al cargar).

type Phase =
  | "loading" // 1. Cargando
  | "unsupported" // 2. No compatible
  | "ios-install" // 3. iPhone/iPad no instalado
  | "prompt" // 4. Compatible, permiso no solicitado
  | "subscribe" // 5. Permiso concedido, sin suscripción
  | "active" // 6. Activo
  | "denied" // 7. Permiso denegado
  | "error"; // 8. Error recuperable

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const raw = window.atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isSupported(): boolean {
  return (
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  );
}

function shortDeviceLabel(): string {
  const platform =
    (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ||
    navigator.platform ||
    "Dispositivo";
  return platform.slice(0, 120);
}

export function NotificationSettings() {
  // Detección sincrónica (iOS sin instalar / sin soporte) en el inicializador:
  // no requiere setState dentro de un efecto.
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window === "undefined") return "loading";
    // iPhone/iPad sin instalar: pasos manuales, sin botón falso de instalación.
    if (isIosDevice() && !isStandalone()) return "ios-install";
    if (!isSupported()) return "unsupported";
    return "loading";
  });
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  // Instalación Chromium: solo ofrecer "Instalar" cuando el evento exista.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // Resolución async (permiso/suscripción/estado servidor) con bandera de
  // cancelación, sin setState sincrónico en el cuerpo del efecto.
  useEffect(() => {
    if (isIosDevice() && !isStandalone()) return;
    if (!isSupported()) return;
    let cancelled = false;
    const finish = (next: Phase, msg: string | null = null) => {
      if (cancelled) return;
      setErrorMsg(msg);
      setPhase(next);
    };
    (async () => {
      try {
        // Estado del servidor (solo flags, sin secretos ni listas).
        try {
          const res = await fetch("/api/push/status");
          if (!cancelled && res.ok) {
            const data = (await res.json()) as { configured?: boolean };
            setServerConfigured(data.configured === true);
            if (data.configured !== true) {
              finish(
                "error",
                "Las notificaciones push aún no están configuradas en el servidor."
              );
              return;
            }
          }
        } catch {
          // Si el estado no se pudo leer, se sigue con la detección local.
        }
        if (cancelled) return;
        if (Notification.permission === "denied") {
          finish("denied");
          return;
        }
        if (Notification.permission === "default") {
          finish("prompt");
          return;
        }
        // Permiso concedido: ¿hay suscripción local en este dispositivo?
        const reg = await navigator.serviceWorker.ready;
        if (cancelled) return;
        const sub = await reg.pushManager.getSubscription();
        finish(sub ? "active" : "subscribe");
      } catch {
        finish("error", "No se pudo comprobar el estado de este dispositivo.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

  const retry = useCallback(() => {
    setErrorMsg(null);
    if (isIosDevice() && !isStandalone()) {
      setPhase("ios-install");
      return;
    }
    if (!isSupported()) {
      setPhase("unsupported");
      return;
    }
    setPhase("loading");
    setRetryNonce((n) => n + 1);
  }, []);

  const fail = (message: string) => {
    setErrorMsg(message);
    setPhase("error");
    setBusy(false);
  };

  async function activate() {
    setBusy(true);
    setErrorMsg(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        fail("Falta la clave pública VAPID en el cliente.");
        return;
      }
      // El permiso SOLO se pide como consecuencia directa de este clic.
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setPhase("denied");
        setBusy(false);
        return;
      }
      if (permission !== "granted") {
        setPhase("prompt");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      // Si quedó una suscripción vieja (p. ej. desactivada en el servidor),
      // se renueva para que el endpoint sea válido.
      const stale = await reg.pushManager.getSubscription();
      if (stale) {
        try {
          await stale.unsubscribe();
        } catch {
          // Se sigue igual: el servidor hace upsert por endpoint.
        }
      }
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: pushSub.toJSON(),
          timeZone,
          deviceLabel: shortDeviceLabel(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        try {
          await pushSub.unsubscribe();
        } catch {
          // Limpieza best-effort; el upsert del servidor es idempotente.
        }
        fail(data.error ?? "No se pudo activar en este dispositivo.");
        return;
      }
      setPhase("active");
      setBusy(false);
    } catch {
      fail("No se pudo activar en este dispositivo.");
    }
  }

  async function deactivate() {
    setBusy(true);
    setErrorMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? null;
      // Primero el navegador, después el servidor (idempotente en ambos).
      if (sub) {
        try {
          await sub.unsubscribe();
        } catch {
          // Se informa igual al servidor para mantener estado recuperable.
        }
      }
      if (endpoint) {
        const res = await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          fail(data.error ?? "No se pudo desactivar en este dispositivo.");
          return;
        }
      }
      setPhase(Notification.permission === "granted" ? "subscribe" : "prompt");
      setBusy(false);
    } catch {
      fail("No se pudo desactivar en este dispositivo.");
    }
  }

  async function sendTest() {
    setBusy(true);
    setErrorMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setPhase("subscribe");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      if (res.ok) {
        setBusy(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 404 || res.status === 410) {
        // La suscripción ya no vale en el servidor: volver a activar.
        try {
          await sub.unsubscribe();
        } catch {
          // Best-effort.
        }
        setPhase("subscribe");
        setErrorMsg(data.error ?? "La suscripción venció. Volvé a activarla.");
        setBusy(false);
        return;
      }
      fail(data.error ?? "No se pudo enviar la prueba.");
    } catch {
      fail("No se pudo enviar la prueba.");
    }
  }

  async function installApp() {
    if (!installEvent) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {
      // El prompt es best-effort.
    } finally {
      setInstallEvent(null);
      setBusy(false);
    }
  }

  const showRetry = phase === "error" && serverConfigured !== false;

  return (
    <section
      aria-label="Notificaciones"
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 sm:p-4"
    >
      <h2 className="font-display text-2xl tracking-tight">Notificaciones</h2>
      <p className="-mt-1 text-sm text-muted">
        Recibí recordatorios de tus asignaciones en este dispositivo, incluso con la
        página cerrada.
      </p>

      {phase === "loading" && (
        <p role="status" className="text-sm text-muted">
          Comprobando este dispositivo…
        </p>
      )}

      {phase === "unsupported" && (
        <p role="status" className="rounded-md border border-line bg-canvas px-3 py-2 text-sm">
          Este navegador no puede recibir notificaciones push. Podés seguir usando el
          calendario del teléfono exportando tus asignaciones.
        </p>
      )}

      {phase === "ios-install" && (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-sm">
          <p className="font-medium">Para activarlas en tu iPhone o iPad:</p>
          <ol className="list-decimal pl-5 text-muted">
            <li>Tocá Compartir en Safari.</li>
            <li>Elegí «Añadir a pantalla de inicio».</li>
            <li>Abrí Mi Ministerio desde el nuevo icono y volvé acá.</li>
          </ol>
          <button
            type="button"
            onClick={() => setShowIosSteps((v) => !v)}
            className="self-start text-sm font-medium text-primary underline underline-offset-2"
          >
            {showIosSteps ? "Ocultar pasos" : "Ver pasos"}
          </button>
          {showIosSteps && (
            <p className="text-muted">
              En iOS las notificaciones solo funcionan desde la app instalada (iOS 16.4 o
              posterior).
            </p>
          )}
        </div>
      )}

      {phase === "prompt" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            Activá las notificaciones para recibir avisos de tus asignaciones en este
            dispositivo.
          </p>
          <button
            type="button"
            onClick={activate}
            disabled={busy}
            className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Activando…" : "Activar notificaciones"}
          </button>
        </div>
      )}

      {phase === "subscribe" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            El permiso está concedido, pero este dispositivo aún no está suscripto.
          </p>
          <button
            type="button"
            onClick={activate}
            disabled={busy}
            className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Activando…" : "Activar en este dispositivo"}
          </button>
        </div>
      )}

      {phase === "active" && (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm font-medium">
            Notificaciones activas en este dispositivo
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={sendTest}
              disabled={busy}
              className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "Enviando…" : "Enviar prueba"}
            </button>
            <button
              type="button"
              onClick={deactivate}
              disabled={busy}
              className="min-h-[48px] rounded-md border border-line bg-canvas px-4 py-2.5 font-medium transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "Desactivando…" : "Desactivar en este dispositivo"}
            </button>
          </div>
        </div>
      )}

      {phase === "denied" && (
        <p role="status" className="rounded-md border border-line bg-canvas px-3 py-2 text-sm">
          Bloqueaste las notificaciones para este sitio. Para volver a activarlas,
          habilitalas desde la configuración del navegador o del sistema y recargá esta
          página.
        </p>
      )}

      {showRetry && errorMsg && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
            {errorMsg}
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={busy}
            className="min-h-[48px] rounded-md border border-line bg-canvas px-4 py-2.5 font-medium transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            Reintentar
          </button>
        </div>
      )}
      {phase === "error" && serverConfigured === false && errorMsg && (
        <p role="status" className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-muted">
          {errorMsg}
        </p>
      )}

      {installEvent && (phase === "prompt" || phase === "subscribe" || phase === "active") && (
        <button
          type="button"
          onClick={installApp}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-primary px-4 text-sm font-medium text-primary transition-colors hover:bg-primary-soft disabled:opacity-60"
        >
          Instalar Mi Ministerio
        </button>
      )}
    </section>
  );
}
