// Despachador de notificaciones Web Push (FASE 4, §§15/16/24 del plan).
//
// Responsabilidades:
// - `processNotificationBatch()`: barrido de caducados/cancelados, claim
//   concurrente del lote vencido, envío por trabajo y resumen sanitizado.
// - El `sender` es inyectable (por defecto `sendPush` de web-push.ts) para
//   poder probar sin red (los tests pasan un mock que simula 200/410/5xx).
//
// Concurrencia (documentado, §15.2):
// - El claim es UNA sola sentencia `UPDATE ... WHERE id IN (SELECT ... FOR
//   UPDATE OF j SKIP LOCKED)` ejecutada vía `$queryRaw`. Es atómica en
//   Postgres: dos crons concurrentes nunca reclaman el mismo trabajo (el
//   segundo salta las filas ya bloqueadas con SKIP LOCKED en vez de
//   quedarse esperando). Se eligió esta variante frente a
//   `updateMany` + reintento porque evita bloqueos entre instancias y
//   frente a SELECT+luego-UPDATE en transacción interactiva porque reduce
//   la ventana a un solo round-trip. La transacción se cierra con el claim;
//   el envío push ocurre SIEMPRE fuera de transacciones.
// - Condición de claim: estado PENDING, FAILED con attempts < max, o
//   PROCESSING (recuperación de lock abandonado, §15.5); nextAttemptAt
//   vencido; scheduledFor dentro de la ventana de lateness; lock libre o
//   con más de STALE_LOCK_MINUTES; y tarea todavía PENDING con
//   reminderEnabled. Los vencidos se marcan EXPIRED en la misma pasada
//   (barrido previo, sin envío).
// - Idempotencia (§15.3/§6.6): upsert por unique
//   (notificationId, subscriptionId, revision); las entregas ya SENT nunca
//   se reenvían.
//
// Privacidad (§§15.1/15.4/24): los logs son JSON estructurado con conteos
// e IDs internos (jobId). NUNCA endpoint, p256dh, auth, claves VAPID,
// CRON_SECRET, notas ni datos de personas. Los `lastError` guardados en DB
// usan códigos sanitizados (`http-410`, `no-active-subscriptions`, ...).
//
// Unidades del resumen (§24): claimed/skipped/expired/cancelled cuentan
// TRABAJOS; sent/failed/gone cuentan ENTREGAS de esta pasada; failedByCode
// agrupa entregas fallidas por código HTTP sanitizado.

import { db } from "@/lib/db";
import { getNotificationTuning } from "./config";
import {
  buildReminderPayload,
  classifyPushError,
  sendPush,
  type PushPayload,
  type PushTarget,
  type SendPushResult,
} from "./web-push";

/** Minutos tras los cuales un lock PROCESSING se considera abandonado (§15.5). */
export const STALE_LOCK_MINUTES = 10;

/** Backoff progresivo en minutos para fallos reintentables: 1, 5 y 15 (§15.4). */
const RETRY_BACKOFF_MINUTES = [1, 5, 15] as const;

export type PushSender = (
  target: PushTarget,
  payload: PushPayload
) => Promise<SendPushResult>;

export interface ProcessBatchOptions {
  /** Tope del lote (el Route Handler lo limita a NOTIFICATION_BATCH_SIZE). */
  limit?: number;
  /** Reclama y reporta sin enviar ni escribir entregas. */
  dryRun?: boolean;
  /** Sender inyectable (tests). Por defecto el sender real de producción. */
  sender?: PushSender;
  /** Reloj inyectable (tests). Por defecto la hora real. */
  now?: Date;
}

export interface BatchSummary {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  expired: number;
  cancelled: number;
  gone: number;
  failedByCode: Record<string, number>;
  durationMs: number;
  dryRun: boolean;
}

interface ClaimedJob {
  id: string;
  taskId: string;
  userId: string;
  revision: number;
  attempts: number;
  scheduledFor: Date;
  nextAttemptAt: Date;
}

type JobOutcome =
  | "sent"
  | "partial"
  | "failed"
  | "expired"
  | "cancelled"
  | "skipped"
  | "deleted";

interface JobResult {
  outcome: JobOutcome;
  sent: number;
  failedByCode: Record<string, number>;
  gone: number;
}

function backoffMinutes(attemptsAfterClaim: number): number {
  const idx = Math.min(Math.max(attemptsAfterClaim, 1), 3) - 1;
  return RETRY_BACKOFF_MINUTES[idx];
}

function addFailedByCode(
  acc: Record<string, number>,
  code: number | undefined,
  n = 1
): void {
  const key = code == null ? "unknown" : `http-${code}`;
  acc[key] = (acc[key] ?? 0) + n;
}

/**
 * Marca EXPIRED (sin envío) los trabajos vencidos superados por la ventana
 * de lateness. Solo toca trabajos no bloqueados por otro worker (locks
 * frescos de PROCESSING se excluyen para no pisar un envío en curso).
 * Devuelve la cantidad marcada.
 */
async function expireOverdueJobs(now: Date, latenessMin: number): Promise<number> {
  const cutoff = new Date(now.getTime() - latenessMin * 60_000);
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MINUTES * 60_000);
  const res = await db.taskNotificationJob.updateMany({
    where: {
      nextAttemptAt: { lte: now },
      scheduledFor: { lt: cutoff },
      OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        {
          status: "PROCESSING",
          OR: [{ lockedAt: null }, { lockedAt: { lte: staleBefore } }],
        },
      ],
    },
    data: {
      status: "EXPIRED",
      lockedAt: null,
      processedAt: now,
      lastError: "expired-lateness",
    },
  });
  return res.count;
}

/**
 * Marca CANCELLED los trabajos vencidos cuya tarea ya no califica
 * (DONE o reminderEnabled=false). No toca locks frescos.
 */
async function cancelDisqualifiedJobs(now: Date): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MINUTES * 60_000);
  const res = await db.taskNotificationJob.updateMany({
    where: {
      nextAttemptAt: { lte: now },
      OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        {
          status: "PROCESSING",
          OR: [{ lockedAt: null }, { lockedAt: { lte: staleBefore } }],
        },
      ],
      task: { OR: [{ status: "DONE" }, { reminderEnabled: false }] },
    },
    data: {
      status: "CANCELLED",
      lockedAt: null,
      processedAt: now,
      lastError: "task-disqualified",
    },
  });
  return res.count;
}

/** Cuenta (sin modificar) cuántos trabajos caducarían / se cancelarían. Para dryRun. */
async function countWouldExpireOrCancel(
  now: Date,
  latenessMin: number
): Promise<{ expired: number; cancelled: number }> {
  const cutoff = new Date(now.getTime() - latenessMin * 60_000);
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MINUTES * 60_000);
  const unlockedOrStale = {
    OR: [
      { status: { in: ["PENDING", "FAILED"] } },
      {
        status: "PROCESSING",
        OR: [{ lockedAt: null }, { lockedAt: { lte: staleBefore } }],
      },
    ],
  } as const;
  const [expired, cancelled] = await Promise.all([
    db.taskNotificationJob.count({
      where: {
        nextAttemptAt: { lte: now },
        scheduledFor: { lt: cutoff },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        OR: (unlockedOrStale as any).OR,
      },
    }),
    db.taskNotificationJob.count({
      where: {
        nextAttemptAt: { lte: now },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        OR: (unlockedOrStale as any).OR,
        task: { OR: [{ status: "DONE" }, { reminderEnabled: false }] },
      },
    }),
  ]);
  return { expired, cancelled };
}

/**
 * Reclama hasta `limit` trabajos vencidos de forma atómica (ver comentario
 * de módulo). Si `bumpAttempts` es false (dryRun) no consume presupuesto
 * de reintentos: el dry-run debe poder ejecutarse sin quemar intentos.
 */
async function claimDueJobs(
  limit: number,
  maxAttempts: number,
  latenessMin: number,
  bumpAttempts: boolean
): Promise<ClaimedJob[]> {
  const bump = bumpAttempts ? 1 : 0;
  return db.$queryRaw<ClaimedJob[]>`
    UPDATE "TaskNotificationJob" AS j
    SET status = 'PROCESSING'::"NotificationJobStatus",
        "lockedAt" = NOW(),
        attempts = j.attempts + ${bump},
        "updatedAt" = NOW()
    WHERE j.id IN (
      SELECT j2.id
      FROM "TaskNotificationJob" AS j2
      JOIN "MinistryTask" AS t ON t.id = j2."taskId"
      WHERE (
          j2.status = 'PENDING'::"NotificationJobStatus"
          OR (j2.status = 'FAILED'::"NotificationJobStatus" AND j2.attempts < ${maxAttempts})
          OR j2.status = 'PROCESSING'::"NotificationJobStatus"
        )
        AND j2."nextAttemptAt" <= NOW()
        AND j2."scheduledFor" >= NOW() - (${latenessMin} * INTERVAL '1 minute')
        AND (j2."lockedAt" IS NULL OR j2."lockedAt" <= NOW() - (${STALE_LOCK_MINUTES} * INTERVAL '1 minute'))
        AND t.status = 'PENDING' AND t."reminderEnabled" = true
      ORDER BY j2."nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE OF j2 SKIP LOCKED
    )
    RETURNING j.id, j."taskId", j."userId", j.revision, j.attempts,
      j."scheduledFor", j."nextAttemptAt"
  `;
}

/** Libera los locks de un dry-run (lockedAt=null, mantiene PROCESSING). */
async function releaseDryRunLocks(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.taskNotificationJob.updateMany({
    where: { id: { in: ids } },
    data: { lockedAt: null },
  });
}

async function finishJob(
  id: string,
  data: {
    status: "SENT" | "PARTIAL" | "FAILED" | "EXPIRED" | "CANCELLED" | "SKIPPED";
    nextAttemptAt?: Date;
    lastError: string | null;
    now: Date;
  }
): Promise<void> {
  await db.taskNotificationJob.update({
    where: { id },
    data: {
      status: data.status,
      ...(data.nextAttemptAt ? { nextAttemptAt: data.nextAttemptAt } : {}),
      lockedAt: null,
      processedAt: data.now,
      lastError: data.lastError,
    },
  });
}

async function processOneJob(
  job: ClaimedJob,
  opts: { sender: PushSender; now: Date; latenessMin: number; maxAttempts: number }
): Promise<JobResult> {
  const { sender, now, latenessMin, maxAttempts } = opts;
  const empty: JobResult = { outcome: "failed", sent: 0, failedByCode: {}, gone: 0 };

  const full = await db.taskNotificationJob.findUnique({
    where: { id: job.id },
    include: { task: { select: { status: true, reminderEnabled: true } } },
  });
  // La tarea fue eliminada (cascada pendiente) o el trabajo desapareció.
  if (!full || !full.task) return { ...empty, outcome: "deleted" };
  if (full.task.status !== "PENDING" || !full.task.reminderEnabled) {
    await finishJob(job.id, {
      status: "CANCELLED",
      lastError: "task-disqualified",
      now,
    });
    return { ...empty, outcome: "cancelled" };
  }
  if (full.scheduledFor.getTime() < now.getTime() - latenessMin * 60_000) {
    await finishJob(job.id, {
      status: "EXPIRED",
      lastError: "expired-lateness",
      now,
    });
    return { ...empty, outcome: "expired" };
  }

  const subs = await db.pushSubscription.findMany({
    where: { userId: job.userId, active: true },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  // Sin suscripciones activas: SKIPPED, sin reintentos infinitos (§15.6).
  if (subs.length === 0) {
    await finishJob(job.id, {
      status: "SKIPPED",
      lastError: "no-active-subscriptions",
      now,
    });
    return { ...empty, outcome: "skipped" };
  }

  const existing = await db.pushNotificationDelivery.findMany({
    where: { notificationId: job.id, revision: job.revision },
  });
  const bySub = new Map(existing.map((d) => [d.subscriptionId, d]));
  const payload = buildReminderPayload({ taskId: job.taskId, revision: job.revision });
  const result: JobResult = { outcome: "failed", sent: 0, failedByCode: {}, gone: 0 };
  let retryable = 0;
  let permanent = 0;

  for (const sub of subs) {
    const prev = bySub.get(sub.id);
    // Entrega ya exitosa para (trabajo, suscripción, revisión): no reenviar.
    if (prev?.status === "SENT") {
      result.sent += 1;
      continue;
    }
    const delivery = await db.pushNotificationDelivery.upsert({
      where: {
        notificationId_subscriptionId_revision: {
          notificationId: job.id,
          subscriptionId: sub.id,
          revision: job.revision,
        },
      },
      create: {
        notificationId: job.id,
        subscriptionId: sub.id,
        revision: job.revision,
        status: "PENDING",
      },
      update: { lastAttemptAt: now },
      select: { id: true },
    });
    let send: SendPushResult;
    try {
      send = await sender(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload
      );
    } catch (err) {
      // Fallos inesperados (p. ej. VAPID sin configurar): reintentable.
      send = { ok: false, error: classifyPushError(err) };
    }
    if (send.ok) {
      await db.pushNotificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SENT",
          attempts: { increment: 1 },
          sentAt: now,
          lastAttemptAt: now,
          errorCode: null,
          errorMessage: null,
        },
      });
      result.sent += 1;
      continue;
    }
    const kind = send.error?.kind ?? "RETRYABLE";
    const code = send.error?.statusCode;
    if (kind === "GONE") {
      await db.pushNotificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "GONE",
          attempts: { increment: 1 },
          lastAttemptAt: now,
          errorCode: code ?? null,
          errorMessage: code != null ? `gone http-${code}` : "gone",
        },
      });
      // Suscripción inválida (404/410): desactivación lógica, conserva
      // diagnóstico y evita futuros envíos a ese endpoint (§15.4).
      await db.pushSubscription.update({
        where: { id: sub.id },
        data: { active: false },
      });
      result.gone += 1;
      continue;
    }
    await db.pushNotificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastAttemptAt: now,
        errorCode: code ?? null,
        errorMessage:
          code != null
            ? `${kind === "RETRYABLE" ? "retryable" : "permanent"} http-${code}`
            : kind === "RETRYABLE"
              ? "retryable"
              : "permanent",
      },
    });
    addFailedByCode(result.failedByCode, code);
    if (kind === "RETRYABLE") retryable += 1;
    else permanent += 1;
  }

  // Agregación (§15.6). Regla documentada: si no hubo fallos reintentables
  // ni permanentes, el trabajo queda SENT aunque parte de las suscripciones
  // se hayan depurado como GONE (ya no queda nada aplicable por hacer).
  const attempts = job.attempts; // ya incrementado en el claim (salvo dryRun)
  const windowEnd = full.scheduledFor.getTime() + latenessMin * 60_000;
  if (retryable === 0 && permanent === 0) {
    await finishJob(job.id, {
      status: "SENT",
      lastError:
        result.gone > 0 ? `sent gone-purged=${result.gone}` : null,
      now,
    });
    return { ...result, outcome: "sent" };
  }
  if (retryable > 0 && attempts < maxAttempts) {
    const next = new Date(now.getTime() + backoffMinutes(attempts) * 60_000);
    // El backoff no puede superar la ventana de lateness: si la supera,
    // el trabajo caduca en vez de reintentarse fuera de término.
    if (next.getTime() > windowEnd) {
      await finishJob(job.id, {
        status: "EXPIRED",
        lastError: "expired-lateness",
        now,
      });
      return { ...result, outcome: "expired" };
    }
    await finishJob(job.id, {
      status: "FAILED",
      nextAttemptAt: next,
      lastError: `retryable sent=${result.sent} retryable=${retryable} permanent=${permanent}`,
      now,
    });
    return { ...result, outcome: "failed" };
  }
  if (result.sent > 0 && permanent > 0 && retryable === 0) {
    await finishJob(job.id, {
      status: "PARTIAL",
      lastError: `partial sent=${result.sent} permanent=${permanent}`,
      now,
    });
    return { ...result, outcome: "partial" };
  }
  await finishJob(job.id, {
    status: "FAILED",
    lastError:
      attempts >= maxAttempts
        ? `max-attempts sent=${result.sent} permanent=${permanent}`
        : `failed sent=${result.sent} retryable=${retryable} permanent=${permanent}`,
    now,
  });
  return { ...result, outcome: "failed" };
}

/**
 * Ejecuta una pasada del despachador: barridos + claim + envíos.
 * Cierra la transacción del claim ANTES de contactar servicios push.
 */
export async function processNotificationBatch(
  opts: ProcessBatchOptions = {}
): Promise<BatchSummary> {
  const started = Date.now();
  const tuning = getNotificationTuning();
  const now = opts.now ?? new Date();
  const limit = Math.min(
    Math.max(opts.limit ?? tuning.batchSize, 1),
    tuning.batchSize
  );
  const sender = opts.sender ?? sendPush;
  const dryRun = opts.dryRun ?? false;

  const summary: BatchSummary = {
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    expired: 0,
    cancelled: 0,
    gone: 0,
    failedByCode: {},
    durationMs: 0,
    dryRun,
  };

  if (dryRun) {
    const [counts, claimed] = await Promise.all([
      countWouldExpireOrCancel(now, tuning.maxLatenessMinutes),
      claimDueJobs(limit, tuning.maxAttempts, tuning.maxLatenessMinutes, false),
    ]);
    summary.expired = counts.expired;
    summary.cancelled = counts.cancelled;
    summary.claimed = claimed.length;
    await releaseDryRunLocks(claimed.map((j) => j.id));
    summary.durationMs = Date.now() - started;
    console.log(JSON.stringify({ scope: "notifications-batch", ...summary }));
    return summary;
  }

  summary.expired = await expireOverdueJobs(now, tuning.maxLatenessMinutes);
  summary.cancelled = await cancelDisqualifiedJobs(now);
  const claimed = await claimDueJobs(
    limit,
    tuning.maxAttempts,
    tuning.maxLatenessMinutes,
    true
  );
  summary.claimed = claimed.length;

  for (const job of claimed) {
    const t0 = Date.now();
    const r = await processOneJob(job, {
      sender,
      now,
      latenessMin: tuning.maxLatenessMinutes,
      maxAttempts: tuning.maxAttempts,
    });
    summary.sent += r.sent;
    summary.gone += r.gone;
    for (const [k, v] of Object.entries(r.failedByCode)) {
      summary.failedByCode[k] = (summary.failedByCode[k] ?? 0) + v;
    }
    if (r.outcome === "failed") summary.failed += 1;
    if (r.outcome === "partial") summary.failed += 1;
    if (r.outcome === "skipped") summary.skipped += 1;
    if (r.outcome === "expired") summary.expired += 1;
    if (r.outcome === "cancelled") summary.cancelled += 1;
    // Log por trabajo problemático (§24): solo IDs internos y conteos.
    if (
      r.outcome === "failed" ||
      r.outcome === "partial" ||
      r.outcome === "expired" ||
      r.outcome === "cancelled" ||
      r.gone > 0
    ) {
      console.log(
        JSON.stringify({
          scope: "notifications-job",
          jobId: job.id,
          outcome: r.outcome,
          revision: job.revision,
          attempts: job.attempts,
          sent: r.sent,
          failedByCode: r.failedByCode,
          gone: r.gone,
          durationMs: Date.now() - t0,
        })
      );
    }
  }

  summary.durationMs = Date.now() - started;
  console.log(JSON.stringify({ scope: "notifications-batch", ...summary }));
  return summary;
}
