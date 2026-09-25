import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { reconcileUserReminders } from "@/lib/notifications/schedule-task-reminder";

// POST /api/push/reconcile → reprograma recordatorios futuros programables
// del propio usuario (§8/§14.3). Solo propio: usa el userId de la sesión.
export async function POST() {
  const { userId } = await requireUser();
  const summary = await reconcileUserReminders(userId);
  return NextResponse.json(summary);
}
