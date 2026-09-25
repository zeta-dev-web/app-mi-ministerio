// Sender Web Push (FASE 2). SOLO servidor: importa `web-push` y las claves
// VAPID. Nunca importar desde código cliente (§16 del plan).
import webpush from "web-push";
import { getPushEnvConfig } from "./config";

let vapidConfigured = false;

/** Ejecuta setVapidDetails una sola vez por proceso. Lanza Error si falta env. */
function ensureVapid(): void {
  if (vapidConfigured) return;
  const cfg = getPushEnvConfig();
  webpush.setVapidDetails(
    cfg.vapidSubject,
    cfg.vapidPublicKey,
    cfg.vapidPrivateKey
  );
  vapidConfigured = true;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  taskId?: string;
  revision?: number;
}

/** Payload discreto por defecto (§5.5): sin notas ni datos sensibles. */
export function buildReminderPayload(input: {
  taskId: string;
  revision: number;
}): PushPayload {
  return {
    title: "Mi Ministerio",
    body: "Tenés una asignación próxima.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/notification-badge.png",
    tag: `task-${input.taskId}-r${input.revision}`,
    url: `/tareas?task=${input.taskId}`,
    taskId: input.taskId,
    revision: input.revision,
  };
}

export type PushErrorKind =
  | "GONE" // 404/410: suscripción inválida → desactivar
  | "RETRYABLE" // 429/5xx: reintentar con backoff
  | "PERMANENT"; // otros 4xx: no reintentar indefinidamente

export interface ClassifiedPushError {
  kind: PushErrorKind;
  statusCode?: number;
}

/**
 * Clasifica errores de web-push por status HTTP (§15.4).
 * Nunca incluye endpoint ni claves en el resultado.
 */
export function classifyPushError(err: unknown): ClassifiedPushError {
  const statusCode =
    typeof (err as { statusCode?: unknown })?.statusCode === "number"
      ? (err as { statusCode: number }).statusCode
      : undefined;
  if (statusCode === 404 || statusCode === 410) return { kind: "GONE", statusCode };
  if (
    statusCode === 429 ||
    (statusCode !== undefined && statusCode >= 500 && statusCode <= 599)
  ) {
    return { kind: "RETRYABLE", statusCode };
  }
  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    return { kind: "PERMANENT", statusCode };
  }
  // Sin status (error de red, timeout): reintentable.
  return { kind: "RETRYABLE", statusCode };
}

export interface SendPushResult {
  ok: boolean;
  error?: ClassifiedPushError;
}

/** Envía una notificación a una suscripción. Sanitiza errores (sin secretos). */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload
): Promise<SendPushResult> {
  ensureVapid();
  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload),
      { urgency: "normal" }
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: classifyPushError(err) };
  }
}
