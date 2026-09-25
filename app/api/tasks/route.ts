import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ministryTaskSchema } from "@/lib/validations/task";
import { canonicalTimeZone, isValidTimeZone } from "@/lib/validations/push";
import {
  ReminderValidationError,
  syncTaskReminder,
} from "@/lib/notifications/schedule-task-reminder";

function emptyToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** Zona del cliente si es válida (canónica), si no la del usuario si es válida. */
function resolveZone(
  clientZone: string | undefined,
  userZone: string | null | undefined
): { client: string | null; effective: string | null } {
  const client =
    typeof clientZone === "string" && isValidTimeZone(clientZone)
      ? canonicalTimeZone(clientZone)
      : null;
  const user =
    typeof userZone === "string" && isValidTimeZone(userZone)
      ? userZone
      : null;
  return { client, effective: client ?? user };
}

export async function GET(req: Request) {
  const { userId } = await requireUser();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const tasks = await db.ministryTask.findMany({
    where: {
      userId,
      ...(status === "PENDING" || status === "DONE" ? { status } : {}),
    },
    orderBy: [{ date: "asc" }, { timeMinute: "asc" }, { createdAt: "asc" }],
    take: 200,
  });
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = ministryTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const v = parsed.data;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timeZone: true },
  });
  const { client, effective } = resolveZone(v.timeZone, user?.timeZone);
  try {
    const created = await db.$transaction(async (tx) => {
      // Última zona conocida del usuario (§5.6).
      if (client && client !== user?.timeZone) {
        await tx.user.update({
          where: { id: userId },
          data: { timeZone: client },
        });
      }
      const task = await tx.ministryTask.create({
        data: {
          userId,
          type: v.type.trim(),
          topic: emptyToNull(v.topic),
          date: new Date(v.date + "T12:00:00.000Z"),
          timeMinute: v.timeMinute ?? null,
          notes: emptyToNull(v.notes),
          reminderEnabled: v.reminderEnabled,
          reminderMinutesBefore: v.reminderEnabled ? (v.reminderMinutesBefore ?? 60) : null,
          reminderAt: v.reminderEnabled && v.reminderAt ? new Date(v.reminderAt) : null,
          reminderTimeZone: v.reminderEnabled ? effective : null,
          status: v.status,
          doneAt: v.status === "DONE" ? new Date() : null,
        },
      });
      // Programa/cancela el trabajo en la misma transacción (§14.2).
      // Sin hora + relativo → 400 (no se inventa hora, §6.1).
      await syncTaskReminder(tx, task, {
        userTimeZone: effective ?? user?.timeZone ?? null,
      });
      return task;
    });
    return NextResponse.json({ task: created }, { status: 201 });
  } catch (e) {
    if (e instanceof ReminderValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
