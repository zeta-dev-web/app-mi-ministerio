import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const registerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(80),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  password: z.string().min(8, "Mínimo 8 caracteres.").max(100),
  acceptedTerms: z.literal(true, {
    message: "Tenés que aceptar los Términos y Condiciones.",
  }),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ese email ya está registrado." }, { status: 409 });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const publicador = await db.serviceRole.findUnique({ where: { code: "PUBLICADOR" } });
  // Las cuentas siempre se crean como USER. El administrador se define por seed.
  await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "USER",
      serviceRoleId: publicador?.id,
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
