// Configuración de notificaciones Web Push (FASE 2).
// SOLO servidor: nunca importar desde componentes cliente ni Route Handlers
// que serialicen estos valores. La clave privada y CRON_SECRET jamás salen
// del servidor (ver §16 y §19 del plan).

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. ` +
        `Revisá .env / .env.example (notificaciones Web Push, FASE 2).`
    );
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(
      `La variable de entorno ${name} debe ser un entero positivo (valor actual inválido).`
    );
  }
  return parsed;
}

export interface PushEnvConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  cronSecret: string;
  maxLatenessMinutes: number;
  batchSize: number;
  maxAttempts: number;
}

export interface NotificationTuning {
  maxLatenessMinutes: number;
  batchSize: number;
  maxAttempts: number;
}

/**
 * Tunables operativos SIN exigir secretos (VAPID/CRON). Para el worker
 * (FASE 4) y dry-run: el cron debe poder reportar aunque falte VAPID.
 * Defaults del plan §16.
 */
export function getNotificationTuning(): NotificationTuning {
  return {
    maxLatenessMinutes: optionalInt("NOTIFICATION_MAX_LATENESS_MINUTES", 30),
    batchSize: optionalInt("NOTIFICATION_BATCH_SIZE", 25),
    maxAttempts: optionalInt("NOTIFICATION_MAX_ATTEMPTS", 5),
  };
}

export function getPushEnvConfig(): PushEnvConfig {
  const tuning = getNotificationTuning();
  return {
    vapidPublicKey: required("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
    vapidPrivateKey: required("VAPID_PRIVATE_KEY"),
    vapidSubject: process.env.VAPID_SUBJECT || "mailto:ministry@localhost",
    cronSecret: required("CRON_SECRET"),
    ...tuning,
  };
}

/** true si hay claves VAPID configuradas (sin lanzar). Para GET /api/push/status. */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}
