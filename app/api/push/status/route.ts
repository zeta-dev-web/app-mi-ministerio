import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { isPushConfigured } from "@/lib/notifications/config";

// GET /api/push/status → estado del servidor (sin secretos ni listas).
export async function GET() {
  await requireUser();
  return NextResponse.json({
    configured: isPushConfigured(),
    serverSupported: true,
  });
}
