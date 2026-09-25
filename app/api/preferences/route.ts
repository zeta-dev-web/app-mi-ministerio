import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { DEFAULT_DISABLED_MINISTRY_TYPES } from "@/lib/ministry-prefs";

const GLOBAL_NAMES = ["Servicio", ...DEFAULT_DISABLED_MINISTRY_TYPES];

export async function GET() {
  const { userId } = await requireUser();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { disabledMinistryTypes: true, ministryTypesConfigured: true },
  });
  return NextResponse.json({
    globals: GLOBAL_NAMES,
    locked: ["Servicio"],
    disabled: !user || !user.ministryTypesConfigured ? DEFAULT_DISABLED_MINISTRY_TYPES : user.disabledMinistryTypes,
    configured: user?.ministryTypesConfigured ?? false,
  });
}

const patchSchema = z.object({
  disabled: z.array(z.string()),
});

export async function PATCH(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  // Solo nombres globales conocidos y nunca se puede ocultar Servicio.
  const disabled = [...new Set(
    parsed.data.disabled.filter((n) => GLOBAL_NAMES.includes(n) && n !== "Servicio")
  )];
  await db.user.update({
    where: { id: userId },
    data: { disabledMinistryTypes: disabled, ministryTypesConfigured: true },
  });
  return NextResponse.json({ ok: true, disabled });
}
