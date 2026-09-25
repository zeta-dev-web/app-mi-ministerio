// POST /api/internal/notifications/process (FASE 4, §15.1 del plan).
// Despachador invocable cada minuto desde el cron del VPS.
//
// - Autenticación EXCLUSIVA por `Authorization: Bearer <CRON_SECRET>` con
//   comparación timing-safe. 401 si falta la variable, la cabecera o el
//   secreto es incorrecto. Nada de sesiones: no se llama a requireUser() ni
//   a getServerSession().
// - Query params: `?limit=` (defecto y tope = NOTIFICATION_BATCH_SIZE) y
//   `?dryRun=1` (reclama y reporta sin enviar).
// - Responde resumen SIN endpoints, claves ni datos personales.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getNotificationTuning } from "@/lib/notifications/config";
import { processNotificationBatch } from "@/lib/notifications/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** true solo si la cabecera coincide con CRON_SECRET (timing-safe). */
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  const space = header.indexOf(" ");
  if (space < 0) return false;
  const scheme = header.slice(0, space);
  const token = header.slice(space + 1);
  if (scheme !== "Bearer" || token.length === 0) return false;
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(secret, "utf8");
  // timingSafeEqual lanza si difieren las longitudes: se rechaza antes.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tuning = getNotificationTuning();
  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  let limit = tuning.batchSize;
  if (rawLimit != null && rawLimit !== "") {
    const parsed = Number.parseInt(rawLimit, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      limit = Math.min(parsed, tuning.batchSize);
    }
  }
  const dryRun = url.searchParams.get("dryRun") === "1";
  try {
    const summary = await processNotificationBatch({ limit, dryRun });
    return NextResponse.json({
      claimed: summary.claimed,
      sent: summary.sent,
      failed: summary.failed,
      skipped: summary.skipped,
      expired: summary.expired,
      cancelled: summary.cancelled,
      durationMs: summary.durationMs,
      dryRun: summary.dryRun,
    });
  } catch {
    // Nunca filtrar detalles internos (ni endpoints) en la respuesta.
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
