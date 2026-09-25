import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isPushConfigured } from "@/lib/notifications/config";
import { sendPush } from "@/lib/notifications/web-push";
import { pushEndpointSchema } from "@/lib/validations/push";

const TEST_COOLDOWN_MS = 30_000;

// Límite de frecuencia en memoria: 1 prueba cada 30s por usuario+endpoint.
// Best-effort (una sola instancia en esta fase); la FASE 4 puede persistirlo.
const lastTestAt = new Map<string, number>();

function tooRecent(key: string): boolean {
  const now = Date.now();
  const prev = lastTestAt.get(key);
  if (prev !== undefined && now - prev < TEST_COOLDOWN_MS) return true;
  lastTestAt.set(key, now);
  return false;
}

// POST /api/push/test {endpoint} → notificación de prueba al dispositivo actual.
// Payload fijo y discreto (§5.5): NO acepta título/cuerpo/url del cliente.
export async function POST(req: Request) {
  const { userId } = await requireUser();
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Las notificaciones push no están configuradas en el servidor." },
      { status: 503 }
    );
  }
  const body = await req.json().catch(() => null);
  const parsed = pushEndpointSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }
  const { endpoint } = parsed.data;

  const sub = await db.pushSubscription.findUnique({ where: { endpoint } });
  if (!sub || sub.userId !== userId || !sub.active) {
    // 404 genérico: no filtrar suscripciones de otros usuarios.
    return NextResponse.json({ error: "Suscripción no encontrada." }, { status: 404 });
  }

  if (tooRecent(`${userId}:${endpoint}`)) {
    return NextResponse.json(
      { error: "Esperá unos segundos antes de enviar otra prueba." },
      { status: 429 }
    );
  }

  const result = await sendPush(
    { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
    {
      title: "Mi Ministerio",
      body: "Tenés una asignación próxima.",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/notification-badge.png",
      // Tag propio de prueba para no colapsar recordatorios reales de tareas.
      tag: "push-test",
      url: "/tareas",
    }
  );

  if (result.ok) return NextResponse.json({ ok: true });

  // Sin secretos ni endpoint en la respuesta: solo categoría sanitizada.
  if (result.error?.kind === "GONE") {
    await db.pushSubscription.update({
      where: { id: sub.id },
      data: { active: false },
    });
    return NextResponse.json(
      { error: "La suscripción ya no es válida en este dispositivo. Volvé a activarla." },
      { status: 410 }
    );
  }
  return NextResponse.json(
    { error: "No se pudo enviar la prueba. Reintentá en unos minutos." },
    { status: 502 }
  );
}
