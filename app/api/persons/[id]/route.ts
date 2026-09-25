import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { interestedPersonSchema } from "@/lib/validations/ministry";

const updateSchema = interestedPersonSchema.partial();

function emptyToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function toDateOrUndefined(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(`${v.trim()}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateInput(v: unknown): Date | null | undefined {
  // Acepta "AAAA-MM-DD" o ISO; normaliza a AAAA-MM-DD para reutilizar toDateOrUndefined.
  if (v === undefined || v === null) return v as null | undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return null;
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return toDateOrUndefined(m ? m[1] : t);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser();
  const { id } = await params;
  const existing = await db.interestedPerson.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  // Compat: acepta ACTIVE/ARCHIVED como alias de revisita/archivado.
  const normalized = body && typeof body === "object" ? { ...body } : body;
  if (normalized && typeof normalized === "object") {
    if ((normalized as Record<string, unknown>).status === "ACTIVE")
      (normalized as Record<string, unknown>).status = "revisita";
    if ((normalized as Record<string, unknown>).status === "ARCHIVED")
      (normalized as Record<string, unknown>).status = "archivado";
  }
  const parsed = updateSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const d = parsed.data;
  const finalStatus = d.status ?? existing.status;
  const updated = await db.interestedPerson.update({
    where: { id },
    data: {
      ...(d.firstName !== undefined ? { firstName: d.firstName.trim() } : {}),
      ...(d.lastName !== undefined ? { lastName: emptyToNull(d.lastName) } : {}),
      ...(d.territory !== undefined ? { territory: emptyToNull(d.territory) } : {}),
      ...(d.address !== undefined ? { address: emptyToNull(d.address) } : {}),
      ...(d.phone !== undefined ? { phone: emptyToNull(d.phone) } : {}),
      ...(d.email !== undefined ? { email: emptyToNull(d.email) } : {}),
      ...(d.age !== undefined ? { age: d.age } : {}),
      ...(d.notes !== undefined ? { notes: emptyToNull(d.notes) } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
      ...(d.language !== undefined ? { language: emptyToNull(d.language) } : {}),
      ...(d.firstContactDate !== undefined ? { firstContactDate: toDateInput(d.firstContactDate) } : {}),
      ...(d.studyPublication !== undefined ? { studyPublication: emptyToNull(d.studyPublication) } : {}),
      ...(d.studyLesson !== undefined ? { studyLesson: d.studyLesson } : {}),
      ...(d.studyTotalLessons !== undefined
        ? { studyTotalLessons: d.studyTotalLessons }
        : d.status === "curso" && existing.studyTotalLessons == null
          ? { studyTotalLessons: 60 }
          : {}),
      ...(d.nextVisitDate !== undefined ? { nextVisitDate: toDateInput(d.nextVisitDate) } : {}),
      ...(d.nextVisitTime !== undefined ? { nextVisitTime: emptyToNull(d.nextVisitTime) } : {}),
      ...(d.nextTopic !== undefined ? { nextTopic: emptyToNull(d.nextTopic) } : {}),
      ...(d.latitude !== undefined ? { latitude: d.latitude } : {}),
      ...(d.longitude !== undefined ? { longitude: d.longitude } : {}),
      // Si se marca como curso sin total, default 60.
      ...(finalStatus === "curso" &&
      d.studyTotalLessons === undefined &&
      existing.studyTotalLessons == null
        ? { studyTotalLessons: 60 }
        : {}),
    },
  });
  return NextResponse.json({ person: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser();
  const { id } = await params;
  const existing = await db.interestedPerson.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  const linked = await db.ministryRecordPerson.count({ where: { personId: id } });
  if (linked > 0) {
    return NextResponse.json(
      { error: "Tiene actividad registrada. Archivarla en lugar de eliminarla." },
      { status: 409 }
    );
  }
  await db.interestedPerson.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
