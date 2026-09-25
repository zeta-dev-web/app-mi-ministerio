import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ministryRecordSchema } from "@/lib/validations/ministry";
import { computeRecordMinutes } from "@/lib/ministry";
import { effectiveDisabledTypes } from "@/lib/ministry-prefs";

type Ctx = { params: Promise<{ id: string }> };

async function owned(id: string, userId: string) {
  return db.ministryRecord.findFirst({
    where: { id, userId },
    include: { ministryType: true, people: { include: { person: true } } },
  });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { userId } = await requireUser();
  const { id } = await params;
  const record = await owned(id, userId);
  if (!record) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ record });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { userId } = await requireUser();
  const { id } = await params;
  const existing = await owned(id, userId);
  if (!existing) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

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

  const manual = v.manualHours != null && v.manualMinutes != null;
  const updated = await db.$transaction(async (tx) => {
    await tx.ministryRecordPerson.deleteMany({ where: { recordId: id } });
    return tx.ministryRecord.update({
      where: { id },
      data: {
        date: new Date(v.date + "T12:00:00.000Z"),
        startMinute: manual ? null : (v.startMinute ?? null),
        endMinute: manual ? null : (v.endMinute ?? null),
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
  });
  return NextResponse.json({ record: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { userId } = await requireUser();
  const { id } = await params;
  const existing = await owned(id, userId);
  if (!existing) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  await db.ministryRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
