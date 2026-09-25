import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes inválido (AAAA-MM).");

const postSchema = z.object({
  month: mesSchema,
  submitted: z.boolean(),
});

export async function GET(req: Request) {
  const { userId } = await requireUser();
  const { searchParams } = new URL(req.url);
  const parsed = mesSchema.safeParse(searchParams.get("mes") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: "Mes inválido (AAAA-MM)." }, { status: 400 });
  }
  const report = await db.ministryReport.findUnique({
    where: { userId_month: { userId, month: parsed.data } },
    select: { submittedAt: true },
  });
  return NextResponse.json({ submittedAt: report?.submittedAt?.toISOString() ?? null });
}

export async function POST(req: Request) {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }
  const { month, submitted } = parsed.data;
  const report = await db.ministryReport.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, submittedAt: submitted ? new Date() : null },
    update: { submittedAt: submitted ? new Date() : null },
    select: { submittedAt: true },
  });
  return NextResponse.json({ ok: true, submittedAt: report.submittedAt?.toISOString() ?? null });
}
