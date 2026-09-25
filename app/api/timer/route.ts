import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

function elapsedSec(startedAt: Date | null, accumulatedSec: number, now: Date): number {
  if (!startedAt) return accumulatedSec;
  const extra = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
  return accumulatedSec + extra;
}

export async function GET() {
  const { userId } = await requireUser();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timerStartedAt: true, timerAccumulatedSec: true },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  const now = new Date();
  return NextResponse.json({
    running: user.timerStartedAt != null,
    elapsedSec: elapsedSec(user.timerStartedAt, user.timerAccumulatedSec, now),
    serverNow: now.getTime(),
  });
}

export async function POST(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const action = body?.action as string | undefined;
  if (action !== "start" && action !== "pause" && action !== "reset") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timerStartedAt: true, timerAccumulatedSec: true },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

  const now = new Date();
  let startedAt = user.timerStartedAt;
  let accumulated = user.timerAccumulatedSec;

  if (action === "start") {
    if (startedAt == null) startedAt = now;
  } else if (action === "pause") {
    if (startedAt != null) {
      accumulated += Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
      startedAt = null;
    }
  } else {
    startedAt = null;
    accumulated = 0;
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { timerStartedAt: startedAt, timerAccumulatedSec: accumulated },
    select: { timerStartedAt: true, timerAccumulatedSec: true },
  });

  return NextResponse.json({
    running: updated.timerStartedAt != null,
    elapsedSec: elapsedSec(updated.timerStartedAt, updated.timerAccumulatedSec, new Date()),
    serverNow: Date.now(),
  });
}
