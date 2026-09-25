import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ministryTaskSchema } from "@/lib/validations/task";
import { canonicalTimeZone, isValidTimeZone } from "@/lib/validations/push";
import {
  ReminderValidationError,
  syncTaskReminder,
} from "@/lib/notifications/schedule-task-reminder";

type Ctx = { params: Promise<{ id: string }> };

function emptyToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** Campos que afectan al instante programado (tema/notas/tipo no reprograman). */
const SCHEDULE_KEYS = [
  "date",
  "timeMinute",
  "reminderEnabled",
  "reminderMinutesBefore",
  "reminderAt",
  "timeZone",
  "status",
] as const;

export async function GET(_req: Request, { params }: Ctx) {
  const { userId } = await requireUser();
  const { id } = await params;
  const task = await db.ministryTask.findFirst({ where: { id, userId } });
  if (!task) return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { userId } = await requireUser();
  const { id } = await params;
  const existing = await db.ministryTask.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "No encontrada." }, { status: 404 });

  const body = await req.json().catch(() => null);
  // Edición parcial: solo los campos enviados (completar es PATCH {status:"DONE"}).
  const parsed = ministryTaskSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const v = parsed.data;
  const status = v.status ?? existing.status;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timeZone: true },
  });
  const clientZone =
    typeof v.timeZone === "string" && isValidTimeZone(v.timeZone)
      ? canonicalTimeZone(v.timeZone)
      : null;
  const userZone =
    typeof user?.timeZone === "string" && isValidTimeZone(user.timeZone)
      ? user.timeZone
      : null;

  const touchesSchedule = SCHEDULE_KEYS.some(
    (k) => (v as Record<string, unknown>)[k] !== undefined
  );
  // Reactivación simple a pendiente (solo {status:"PENDING"}): si el
  // recordatorio ya venció se cancela en vez de fallar (§6.4).
  const lenientPast =
    v.status === "PENDING" &&
    !SCHEDULE_KEYS.some(
      (k) =>
        k !== "status" && (v as Record<string, unknown>)[k] !== undefined
    );

  try {
    const updated = await db.$transaction(async (tx) => {
      if (clientZone && clientZone !== user?.timeZone) {
        await tx.user.update({
          where: { id: userId },
          data: { timeZone: clientZone },
        });
      }
      const task = await tx.ministryTask.update({
        where: { id },
        data: {
          ...(v.type !== undefined ? { type: v.type.trim() } : {}),
          ...(v.topic !== undefined ? { topic: emptyToNull(v.topic) } : {}),
          ...(v.date !== undefined ? { date: new Date(v.date + "T12:00:00.000Z") } : {}),
          ...(v.timeMinute !== undefined ? { timeMinute: v.timeMinute } : {}),
          ...(v.notes !== undefined ? { notes: emptyToNull(v.notes) } : {}),
          ...(v.reminderEnabled !== undefined ? { reminderEnabled: v.reminderEnabled } : {}),
          ...(v.reminderMinutesBefore !== undefined ? { reminderMinutesBefore: v.reminderMinutesBefore } : {}),
          ...(v.reminderAt !== undefined ? { reminderAt: v.reminderAt ? new Date(v.reminderAt) : null } : {}),
          ...(clientZone ? { reminderTimeZone: clientZone } : {}),
          status,
          doneAt: status === "DONE" ? (existing.doneAt ?? new Date()) : null,
        },
      });
      // Solo se toca el trabajo si cambió algo que afecta al instante (§6.4:
      // cambiar solo tema/notas no lo toca). Sin push dentro de la tx (§14.2).
      if (touchesSchedule) {
        await syncTaskReminder(tx, task, {
          userTimeZone: clientZone ?? userZone,
          onPast: lenientPast ? "cancel" : "throw",
        });
      }
      return task;
    });
    return NextResponse.json({ task: updated });
  } catch (e) {
    if (e instanceof ReminderValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { userId } = await requireUser();
  const { id } = await params;
  const existing = await db.ministryTask.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  // El trabajo y sus entregas se eliminan en cascada por schema
  // (TaskNotificationJob.task onDelete: Cascade, §6.4).
  await db.ministryTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
