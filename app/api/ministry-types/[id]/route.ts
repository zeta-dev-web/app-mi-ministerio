import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ministryTypeSchema } from "@/lib/validations/ministry";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = ministryTypeSchema.partial();

export async function PATCH(req: Request, { params }: Ctx) {
  const { userId } = await requireUser();
  const { id } = await params;
  // Solo tipos propios; los globales se gestionan con preferencias (ocultar).
  const existing = await db.ministryType.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const v = parsed.data;
  if (v.name) {
    const dup = await db.ministryType.findFirst({
      where: {
        id: { not: id },
        name: { equals: v.name.trim(), mode: "insensitive" },
        OR: [{ userId: null }, { userId }],
      },
    });
    if (dup) return NextResponse.json({ error: "Ya existe un tipo con ese nombre." }, { status: 409 });
  }
  const updated = await db.ministryType.update({
    where: { id },
    data: {
      ...(v.name !== undefined ? { name: v.name.trim() } : {}),
      ...(v.active !== undefined ? { active: v.active } : {}),
    },
  });
  return NextResponse.json({ type: updated });
}
