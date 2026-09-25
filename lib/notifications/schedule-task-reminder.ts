// Programación de recordatorios de asignaciones (FASE 3, §§6/14 del plan).
//
// - `syncTaskReminder(tx, task, opts)`: idempotente; crea, actualiza o cancela
//   el TaskNotificationJob de la tarea. Pensada para llamarse DENTRO de la
//   transacción del llamador: recibe el cliente `tx` y NO abre transacción
//   propia. NUNCA envía push (solo escribe el trabajo; el despacho es FASE 4).
// - `reconcileUserReminders(userId)`: revisa pendientes futuras con
//   recordatorio activo y programa lo programable (§8); devuelve
//   { scheduled, skipped: [{ taskId, reason } ] }.
//
// Reglas (§6.1–6.4):
// - Relativo: exige fecha + timeMinute + anticipación en {15,30,60,120,1440}
//   + zona IANA válida. Sin hora concreta → error (no se inventa hora).
// - Personalizado (reminderAt): instante ISO explícito, futuro; no coexiste
//   con anticipación relativa activa.
// - El instante resultante debe ser futuro al crear/editar.
// - DONE o reminderEnabled=false → cancela el trabajo activo.
// - Reprogramar (fecha/hora/anticipación/zona/personalizado) → revisión + 1.
// - Mismo instante + trabajo activo → no se toca (tema/notas no reprograman).
// - Volver a pendiente con instante ya vencido no reactiva: con
//   `onPast: "cancel"` el trabajo se cancela en vez de lanzar error.

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  canonicalTimeZone,
  isValidTimeZone,
  taskDateTimeToUtc,
} from "./time-zone";

/** Acepta el cliente transaccional (`tx`) y también el cliente base (`db`). */
export type ReminderStore = Pick<Prisma.TransactionClient, "taskNotificationJob">;

export const REMINDER_LEAD_OPTIONS = [15, 30, 60, 120, 1440] as const;

/** Error de validación funcional → el llamador lo mapea a 400. */
export class ReminderValidationError extends Error {}

/** El instante calculado ya pasó (subcaso que permite cancelación leniente). */
export class ReminderNotFutureError extends ReminderValidationError {}

/** Subconjunto de MinistryTask necesario para programar (vale el modelo). */
export interface ReminderTaskInput {
  id: string;
  userId: string;
  date: Date;
  timeMinute: number | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number | null;
  reminderAt: Date | null;
  reminderTimeZone: string | null;
  status: "PENDING" | "DONE";
}

export type ReminderDecision =
  | { scheduledFor: Date }
  | { cancel: string };

/** Fecha calendario AAAA-MM-DD de un campo @db.Date (medianoche UTC). */
export function calendarDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Zona efectiva: la de la tarea, si no la del usuario (canónica si válida). */
function effectiveZone(
  taskZone: string | null,
  userZone: string | null | undefined
): string | null {
  if (taskZone && isValidTimeZone(taskZone)) return canonicalTimeZone(taskZone);
  if (userZone && isValidTimeZone(userZone)) return canonicalTimeZone(userZone);
  return null;
}

/**
 * Calcula el instante deseado (puro, sin DB). Lanza ReminderValidationError
 * con mensaje claro en español si la configuración es inválida.
 */
export function computeReminderInstant(
  task: ReminderTaskInput,
  userTimeZone?: string | null,
  now: Date = new Date()
): ReminderDecision {
  if (task.status === "DONE") return { cancel: "completed" };
  if (!task.reminderEnabled) return { cancel: "disabled" };

  const hasCustom = task.reminderAt != null;
  const hasLead = task.reminderMinutesBefore != null;
  if (hasCustom && hasLead) {
    throw new ReminderValidationError(
      "El recordatorio personalizado no puede combinarse con una anticipación relativa. Desactivá uno de los dos."
    );
  }

  if (hasCustom) {
    const at = new Date(task.reminderAt as Date);
    if (Number.isNaN(at.getTime())) {
      throw new ReminderValidationError(
        "El recordatorio personalizado es inválido."
      );
    }
    if (at.getTime() <= now.getTime()) {
      throw new ReminderNotFutureError(
        "El recordatorio debe estar en el futuro."
      );
    }
    return { scheduledFor: at };
  }

  // Modo relativo (§6.1): fecha + hora + anticipación + zona, todo obligatorio.
  const lead = task.reminderMinutesBefore;
  if (
    lead == null ||
    !Number.isInteger(lead) ||
    !(REMINDER_LEAD_OPTIONS as readonly number[]).includes(lead)
  ) {
    throw new ReminderValidationError(
      "Anticipación inválida: debe ser 15, 30, 60, 120 o 1440 minutos."
    );
  }
  if (task.timeMinute == null) {
    throw new ReminderValidationError(
      "Agregá una hora a la asignación o elegí un recordatorio personalizado con fecha y hora propias."
    );
  }
  const zone = effectiveZone(task.reminderTimeZone, userTimeZone ?? null);
  if (!zone) {
    throw new ReminderValidationError(
      "Falta una zona horaria válida para calcular el recordatorio."
    );
  }
  let instant: Date;
  try {
    instant = taskDateTimeToUtc(
      calendarDateStr(task.date),
      task.timeMinute,
      zone
    );
  } catch (e) {
    throw new ReminderValidationError(
      e instanceof Error ? e.message : "Fecha u hora inválida."
    );
  }
  const scheduledFor = new Date(instant.getTime() - lead * 60_000);
  if (scheduledFor.getTime() <= now.getTime()) {
    throw new ReminderNotFutureError(
      "El recordatorio debe estar en el futuro."
    );
  }
  return { scheduledFor };
}

function isActiveStatus(status: string): boolean {
  return status === "PENDING" || status === "PROCESSING" || status === "FAILED";
}

/** Aplica la decisión sobre TaskNotificationJob (idempotente). */
async function applyReminderDecision(
  store: ReminderStore,
  task: ReminderTaskInput,
  decision: ReminderDecision
) {
  const existing = await store.taskNotificationJob.findUnique({
    where: { taskId: task.id },
  });
  if ("cancel" in decision) {
    // Solo se cancelan trabajos activos; los terminales (SENT, PARTIAL,
    // EXPIRED, SKIPPED, CANCELLED) conservan su historial.
    if (existing && isActiveStatus(existing.status)) {
      return store.taskNotificationJob.update({
        where: { taskId: task.id },
        data: { status: "CANCELLED", lockedAt: null, lastError: null },
      });
    }
    return existing;
  }
  const instant = decision.scheduledFor;
  if (existing) {
    const sameInstant = existing.scheduledFor.getTime() === instant.getTime();
    if (sameInstant && isActiveStatus(existing.status)) return existing;
    // Reprograma (o reactiva un trabajo terminal/cancelado): revisión + 1.
    return store.taskNotificationJob.update({
      where: { taskId: task.id },
      data: {
        scheduledFor: instant,
        nextAttemptAt: instant,
        revision: existing.revision + 1,
        status: "PENDING",
        attempts: 0,
        lockedAt: null,
        processedAt: null,
        lastError: null,
      },
    });
  }
  return store.taskNotificationJob.create({
    data: {
      taskId: task.id,
      userId: task.userId,
      scheduledFor: instant,
      nextAttemptAt: instant,
      revision: 1,
      status: "PENDING",
    },
  });
}

export interface SyncTaskReminderOptions {
  userTimeZone?: string | null;
  now?: Date;
  /**
   * "throw" (defecto): un instante vencido lanza ReminderNotFutureError.
   * "cancel": un instante vencido cancela el trabajo activo en vez de lanzar
   * (para reactivar a pendiente sin reprogramar un recordatorio ya vencido).
   */
  onPast?: "throw" | "cancel";
}

/**
 * Sincroniza el trabajo de notificación de una tarea.
 * Debe llamarse DENTRO de la transacción del llamador (recibe `tx`).
 */
export async function syncTaskReminder(
  tx: ReminderStore,
  task: ReminderTaskInput,
  opts: SyncTaskReminderOptions = {}
) {
  const now = opts.now ?? new Date();
  try {
    const decision = computeReminderInstant(
      task,
      opts.userTimeZone ?? null,
      now
    );
    return applyReminderDecision(tx, task, decision);
  } catch (e) {
    if (
      opts.onPast === "cancel" &&
      e instanceof ReminderNotFutureError
    ) {
      return applyReminderDecision(tx, task, { cancel: "past" });
    }
    throw e;
  }
}

export interface ReconcileSkipped {
  taskId: string;
  reason: string;
}

export interface ReconcileSummary {
  scheduled: number;
  skipped: ReconcileSkipped[];
}

/**
 * Reconciliación (§8/§14.3): programa recordatorios futuros programables del
 * usuario. Personalizados futuros: sí. Relativos: solo con timeMinute y zona
 * válida. Lo que necesite hora o corrección se informa en `skipped`.
 * Idempotente: puede ejecutarse varias veces sin duplicar trabajos.
 */
export async function reconcileUserReminders(
  userId: string,
  opts: { now?: Date } = {}
): Promise<ReconcileSummary> {
  const now = opts.now ?? new Date();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timeZone: true },
  });
  if (!user) throw new Error("Usuario no encontrado.");
  const tasks = await db.ministryTask.findMany({
    where: { userId, status: "PENDING", reminderEnabled: true },
    orderBy: { date: "asc" },
    take: 500,
  });
  let scheduled = 0;
  const skipped: ReconcileSkipped[] = [];
  for (const task of tasks) {
    try {
      const decision = computeReminderInstant(task, user.timeZone, now);
      if ("cancel" in decision) continue; // no debería pasar (filtro PENDING+enabled)
      await applyReminderDecision(db, task, decision);
      scheduled += 1;
    } catch (e) {
      skipped.push({
        taskId: task.id,
        reason:
          e instanceof ReminderValidationError
            ? e.message
            : "No se pudo programar el recordatorio.",
      });
    }
  }
  return { scheduled, skipped };
}
