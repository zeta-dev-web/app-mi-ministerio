import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ministryTypeSchema } from "@/lib/validations/ministry";
import { effectiveDisabledTypes } from "@/lib/ministry-prefs";

export async function GET(req: Request) {
  const { userId } = await requireUser();
  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "true";
  const disabled = await effectiveDisabledTypes(userId);
  const types = await db.ministryType.findMany({
    where: {
      OR: [{ userId }, { userId: null, name: { notIn: disabled } }],
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: [{ userId: "asc" }, { sortOrder: "asc" }],
  });
  // Servicio (global, nunca ocultable) siempre primero aunque el orden falle.
  return NextResponse.json({ types });
}

export async function POST(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = ministryTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const existing = await db.ministryType.findFirst({
    where: {
      name: { equals: parsed.data.name, mode: "insensitive" },
      OR: [{ userId: null }, { userId }],
    },
  });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un tipo con ese nombre." }, { status: 409 });
  }
  const created = await db.ministryType.create({
    data: { userId, name: parsed.data.name.trim(), active: parsed.data.active, sortOrder: 100 },
  });
  return NextResponse.json({ type: created }, { status: 201 });
}
