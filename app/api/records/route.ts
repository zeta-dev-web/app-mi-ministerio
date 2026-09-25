import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ministryRecordSchema } from "@/lib/validations/ministry";
import { computeRecordMinutes } from "@/lib/ministry";
import { effectiveDisabledTypes } from "@/lib/ministry-prefs";

export async function GET(req: Request) {
  const { userId } = await requireUser();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const records = await db.ministryRecord.findMany({
    where: {
      userId,
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: {
      ministryType: true,
      people: { include: { person: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ records });
}

export async function POST(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = ministryRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const v = parsed.data;

  const type = await db.ministryType.findFirst({
    where: { id: v.ministryTypeId, OR: [{ userId: null }, { userId }], active: true },
  });
  if (!type) {
    return NextResponse.json({ error: "Tipo de ministerio inválido." }, { status: 400 });
  }
  if (type.userId == null) {
    const disabled = await effectiveDisabledTypes(userId);
    if (disabled.includes(type.name)) {
      return NextResponse.json({ error: "Ese tipo está oculto. Habilitalo en Configuración." }, { status: 400 });
    }
  }

  if (v.personIds.length > 0) {
    const count = await db.interestedPerson.count({
      where: { id: { in: v.personIds }, userId, status: { not: "archivado" } },
    });
    if (count !== new Set(v.personIds).size) {
      return NextResponse.json({ error: "Una o más personas no te pertenecen o están archivadas." }, { status: 400 });
    }
  }

  const computed = computeRecordMinutes({
    startMinute: v.startMinute,
    endMinute: v.endMinute,
    manualHours: v.manualHours,
    manualMinutes: v.manualMinutes,
  });
  if (!computed.ok) {
    return NextResponse.json({ error: computed.error }, { status: 400 });
  }

  const created = await db.ministryRecord.create({
    data: {
      userId,
      date: new Date(v.date + "T12:00:00.000Z"),
      startMinute: v.manualHours != null && v.manualMinutes != null ? null : (v.startMinute ?? null),
      endMinute: v.manualHours != null && v.manualMinutes != null ? null : (v.endMinute ?? null),
      manualHours: v.manualHours ?? null,
      manualMinutes: v.manualMinutes ?? null,
      minutes: computed.minutes,
      ministryTypeId: v.ministryTypeId,
      didStudy: v.didStudy,
      didVisit: v.didVisit,
      notes: v.notes?.trim() || null,
      people: { create: v.personIds.map((personId) => ({ personId })) },
    },
    include: { ministryType: true, people: { include: { person: true } } },
  });
  return NextResponse.json({ record: created }, { status: 201 });
}
