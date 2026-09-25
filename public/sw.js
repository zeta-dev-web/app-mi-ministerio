/* Service worker de Mi Ministerio — Fase 1: solo Web Push.
 * Sin manejador `fetch`, sin Cache Storage (online-first).
 * Controla el scope "/" y se sirve desde /sw.js con cabeceras no-cache (ver next.config.ts).
 */

/* global self */
"use strict";

const DEFAULT_TITLE = "Mi Ministerio";
const DEFAULT_BODY = "Tenés una asignación próxima.";
const DEFAULT_ICON = "/icons/icon-192x192.png";
const DEFAULT_BADGE = "/icons/notification-badge.png";
const DEFAULT_URL = "/tareas";

/** Acepta únicamente rutas internas (misma origen). Rechaza esquemas, hosts y `//`.
 * Lógica duplicada en `lib/sw-url.ts` (sanitizeClickUrl) para tests: mantener en sync. */
function toSafeUrl(value) {
  if (typeof value !== "string" || value.length === 0) return DEFAULT_URL;
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_URL;
  return value;
}

function toSafeIcon(value, fallback) {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

self.addEventListener("install", () => {
  // Instalación mínima: NO se llama a skipWaiting() aquí.
  // La actualización se aplica solo tras confirmación del usuario (mensaje SKIP_WAITING).
});

self.addEventListener("activate", (event) => {
  // Toma control de las páginas abiertas sin recargarlas ni cachear nada.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      if (event.data) {
        try {
          const parsed = event.data.json();
          if (parsed && typeof parsed === "object") payload = parsed;
        } catch {
          payload = {};
        }
      }

      const taskId = typeof payload.taskId === "string" ? payload.taskId : "unknown";
      const revisionRaw = Number(payload.revision);
      const revision = Number.isFinite(revisionRaw) ? Math.trunc(revisionRaw) : 1;
      const title =
        typeof payload.title === "string" && payload.title.length > 0 ? payload.title : DEFAULT_TITLE;
      const body =
        typeof payload.body === "string" && payload.body.length > 0 ? payload.body : DEFAULT_BODY;

      await self.registration.showNotification(title, {
        body,
        icon: toSafeIcon(payload.icon, DEFAULT_ICON),
        badge: toSafeIcon(payload.badge, DEFAULT_BADGE),
        tag: `task-${taskId}-r${revision}`,
        renotify: false,
        data: {
          url: toSafeUrl(payload.url),
          taskId,
          revision,
        },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification && event.notification.data;
  const url = toSafeUrl(data && data.url);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (typeof client.focus !== "function") continue;
        try {
          if (typeof client.navigate === "function") await client.navigate(url);
          await client.focus();
          return;
        } catch {
          // Si esta ventana falla, se intenta con la siguiente.
        }
      }
      if (typeof self.clients.openWindow === "function") {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
