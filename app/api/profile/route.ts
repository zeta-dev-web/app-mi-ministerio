import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { profileSchema } from "@/lib/validations/profile";

function toDateOnly(v: string | null | undefined): Date | null {
  if (!v) return null;
  return new Date(v + "T12:00:00.000Z");
}

function emptyToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function GET() {
  const { userId } = await requireUser();
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { serviceRole: true },
  });
  if (!user) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({
    profile: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      congregation: user.congregation,
      baptismDate: user.baptismDate?.toISOString().slice(0, 10) ?? null,
      publisherSince: user.publisherSince?.toISOString().slice(0, 10) ?? null,
      personalGoalHours: user.personalGoalHours,
      annualGoalHours: user.annualGoalHours,
      serviceRole: user.serviceRole,
      recipientName: user.recipientName,
      recipientPhone: user.recipientPhone,
      carryMinutes: user.carryMinutes,
    },
  });
}

export async function PATCH(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const v = parsed.data;

  if (v.serviceRoleId) {
    const role = await db.serviceRole.findFirst({ where: { id: v.serviceRoleId, active: true } });
    if (!role) return NextResponse.json({ error: "Condición de servicio inválida." }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      name: v.name.trim(),
      phone: emptyToNull(v.phone),
      congregation: emptyToNull(v.congregation),
      baptismDate: toDateOnly(emptyToNull(v.baptismDate) ?? undefined),
      publisherSince: toDateOnly(emptyToNull(v.publisherSince) ?? undefined),
      personalGoalHours: v.personalGoalHours ?? null,
      annualGoalHours: v.annualGoalHours ?? null,
      serviceRoleId: v.serviceRoleId ?? null,
      recipientName: emptyToNull(v.recipientName),
      recipientPhone: emptyToNull(v.recipientPhone),
      ...(v.carryMinutes !== undefined ? { carryMinutes: v.carryMinutes } : {}),
    },
    include: { serviceRole: true },
  });
  return NextResponse.json({ ok: true, serviceRole: updated.serviceRole });
}
