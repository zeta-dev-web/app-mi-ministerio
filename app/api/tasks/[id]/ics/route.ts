import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { buildTaskICS } from "@/lib/ics";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser();
  const { id } = await params;
  const task = await db.ministryTask.findFirst({ where: { id, userId } });
  if (!task) return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  const ics = buildTaskICS(task);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="tarea-${task.id}.ics"`,
    },
  });
}
