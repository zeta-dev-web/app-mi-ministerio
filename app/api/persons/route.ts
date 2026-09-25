import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { interestedPersonSchema } from "@/lib/validations/ministry";

const ACTIVE_STATUSES = ["revisita", "curso", "no_en_casa", "no_visitar"] as const;

function normalizeStatusParam(raw: string | null): string | "ACTIVE_SET" {
  if (!raw) return "ACTIVE_SET";
  const s = raw.trim();
  if ((ACTIVE_STATUSES as readonly string[]).includes(s) || s === "archivado") return s;
  // Compatibilidad con valores anteriores
  if (s === "ACTIVE") return "ACTIVE_SET";
  if (s === "ARCHIVED") return "archivado";
  return "ACTIVE_SET";
}

function toDateOrNull(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(`${v.trim()}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function emptyToNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

export async function GET(req: Request) {
  const { userId } = await requireUser();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const normalized = normalizeStatusParam(searchParams.get("status"));
  const statusFilter =
    normalized === "ACTIVE_SET" ? { in: [...ACTIVE_STATUSES] } : normalized;
  const people = await db.interestedPerson.findMany({
    where: {
      userId,
      status: statusFilter,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
              { notes: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 100,
  });
  return NextResponse.json({ people });
}

export async function POST(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = interestedPersonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const d = parsed.data;
  const created = await db.interestedPerson.create({
    data: {
      userId,
      firstName: d.firstName.trim(),
      lastName: d.lastName?.trim() || null,
      territory: d.territory?.trim() || null,
      address: d.address?.trim() || null,
      phone: d.phone?.trim() || null,
      email: d.email?.trim() || null,
      age: d.age ?? null,
      notes: d.notes?.trim() || null,
      status: d.status,
      language: d.language?.trim() || null,
      firstContactDate: toDateOrNull(d.firstContactDate),
      studyPublication: emptyToNull(d.studyPublication),
      studyLesson: d.studyLesson ?? null,
      studyTotalLessons:
        d.status === "curso" ? (d.studyTotalLessons ?? 60) : (d.studyTotalLessons ?? null),
      nextVisitDate: toDateOrNull(d.nextVisitDate),
      nextVisitTime: emptyToNull(d.nextVisitTime),
      nextTopic: emptyToNull(d.nextTopic),
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
    },
  });
  return NextResponse.json({ person: created }, { status: 201 });
}
