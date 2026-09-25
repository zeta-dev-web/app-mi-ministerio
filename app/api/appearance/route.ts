import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isMissingAppearanceColumns } from "@/lib/appearance";

const appearanceSchema = z.object({
  theme: z.enum(["light", "dark"]),
  palette: z.enum(["sage", "sky", "lavender", "terracotta", "honey", "rose"]),
});

export async function PATCH(req: Request) {
  const { userId } = await requireUser();
  const parsed = appearanceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Apariencia inválida." }, { status: 400 });

  try {
    const updated = await db.user.update({
      where: { id: userId },
      data: { appearanceTheme: parsed.data.theme, appearancePalette: parsed.data.palette },
      select: { appearanceTheme: true, appearancePalette: true },
    });
    return NextResponse.json({ theme: updated.appearanceTheme, palette: updated.appearancePalette });
  } catch (error) {
    if (isMissingAppearanceColumns(error)) {
      return NextResponse.json({ error: "Las preferencias de apariencia aún no están disponibles en la base de datos. Aplicá la migración pendiente y reintentá." }, { status: 503 });
    }
    throw error;
  }
}
