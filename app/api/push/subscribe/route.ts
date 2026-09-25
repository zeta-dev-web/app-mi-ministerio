import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { pushSubscribeSchema, pushEndpointSchema, canonicalTimeZone } from "@/lib/validations/push";
import { reconcileUserReminders } from "@/lib/notifications/schedule-task-reminder";

function emptyToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

// POST /api/push/subscribe → alta/upsert de la suscripción del dispositivo actual.
export async function POST(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = pushSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }
  const v = parsed.data;
  const userAgent = req.headers.get("user-agent");
  // Se guarda la forma canónica (los navegadores suelen enviar alias como
  // "America/Argentina/Buenos_Aires"; la FASE 3 calculará sobre esta zona).
  const timeZone = canonicalTimeZone(v.timeZone);

  // Upsert por endpoint: el endpoint identifica la instalación del navegador,
  // no al usuario; si cambia de cuenta se reasocia al usuario autenticado.
  await db.pushSubscription.upsert({
    where: { endpoint: v.subscription.endpoint },
    create: {
      userId,
      endpoint: v.subscription.endpoint,
      p256dh: v.subscription.keys.p256dh,
      auth: v.subscription.keys.auth,
      userAgent,
      deviceLabel: emptyToNull(v.deviceLabel),
      timeZone,
      active: true,
      lastSeenAt: new Date(),
    },
    update: {
      userId,
      p256dh: v.subscription.keys.p256dh,
      auth: v.subscription.keys.auth,
      userAgent,
      deviceLabel: emptyToNull(v.deviceLabel),
      timeZone,
      active: true,
      lastSeenAt: new Date(),
    },
  });

  // Reconciliación FASE 3 (§8/§14.3): guarda la zona si el usuario no tiene
  // y programa recordatorios futuros programables. No debe romper el alta:
  // si falla, la suscripción ya quedó confirmada y se informa el error.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timeZone: true },
  });
  if (user && !user.timeZone) {
    await db.user.update({
      where: { id: userId },
      data: { timeZone },
    });
  }

  let reconcile: unknown = null;
  try {
    reconcile = await reconcileUserReminders(userId);
  } catch (e) {
    reconcile = {
      scheduled: 0,
      skipped: [],
      error: e instanceof Error ? e.message : "No se pudo reconciliar.",
    };
  }

  return NextResponse.json({ ok: true, reconcile }, { status: 201 });
}

// DELETE /api/push/subscribe {endpoint} → baja lógica idempotente.
export async function DELETE(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = pushEndpointSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }
  // Idempotente: si no existe, ok igual. Si pertenece a otro usuario,
  // 404 genérico para no filtrar suscripciones ajenas.
  const existing = await db.pushSubscription.findUnique({
    where: { endpoint: parsed.data.endpoint },
    select: { id: true, userId: true },
  });
  if (!existing) return NextResponse.json({ ok: true });
  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Suscripción no encontrada." }, { status: 404 });
  }
  await db.pushSubscription.update({
    where: { id: existing.id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
