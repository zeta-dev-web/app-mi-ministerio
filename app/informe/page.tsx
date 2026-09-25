import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { InformeClient } from "./client";
import { monthLeftover, reportedHours, type ReportData } from "@/lib/report";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parseMes(mes: string | undefined, now: Date): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? "");
  if (m) {
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { year: Number(m[1]), month: month - 1 };
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

function shiftMes(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function InformePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { userId } = await requireUser();
  const now = new Date();
  const sp = await searchParams;
  const parsed = parseMes(sp.mes, now);
  const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const requestedKey = `${parsed.year}-${String(parsed.month + 1).padStart(2, "0")}`;
  const { year, month } = requestedKey > currentKey
    ? { year: now.getUTCFullYear(), month: now.getUTCMonth() }
    : parsed;
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  const prevFrom = new Date(Date.UTC(year, month - 1, 1));
  const prevTo = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const [user, records, report, prevRecords] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, include: { serviceRole: true } }),
    db.ministryRecord.findMany({
      where: { userId, date: { gte: from, lte: to } },
      include: { people: { select: { personId: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    db.ministryReport.findUnique({
      where: { userId_month: { userId, month: `${year}-${String(month + 1).padStart(2, "0")}` } },
      select: { submittedAt: true },
    }),
    db.ministryRecord.findMany({
      where: { userId, date: { gte: prevFrom, lte: prevTo } },
      select: { minutes: true },
    }),
  ]);

  const studyPersons = new Set<string>();
  for (const r of records) {
    if (r.didStudy) {
      for (const p of r.people) studyPersons.add(p.personId);
    }
  }

  const totalMinutes = records.reduce((a, r) => a + r.minutes, 0);
  const isPublisher = user?.serviceRole?.code === "PUBLICADOR";
  const carry = user?.carryMinutes ?? false;
  const prevTotal = prevRecords.reduce((a, r) => a + r.minutes, 0);
  const prevLeftover = monthLeftover(prevTotal);
  const { reportedHours: reported } = isPublisher
    ? { reportedHours: 0 }
    : reportedHours(totalMinutes, prevLeftover, carry);

  const data: ReportData = {
    monthLabel: `${MESES[month]} ${year}`,
    name: user?.name ?? user?.email ?? "",
    serviceRole: user?.serviceRole?.label ?? null,
    congregation: user?.congregation ?? null,
    isPublisher,
    totalMinutes,
    goalHours: user?.personalGoalHours ?? user?.serviceRole?.monthlyQuota ?? null,
    studyPersonCount: studyPersons.size,
    carryMinutes: carry,
    prevLeftover,
    reportedHours: reported,
  };

  return (
    <InformeClient
      data={data}
      mesKey={`${year}-${String(month + 1).padStart(2, "0")}`}
      prevKey={shiftMes(year, month, -1)}
      nextKey={year === now.getUTCFullYear() && month === now.getUTCMonth() ? null : shiftMes(year, month, 1)}
      submittedAt={report?.submittedAt?.toISOString() ?? null}
      recipientName={user?.recipientName ?? null}
      recipientPhone={user?.recipientPhone ?? null}
      hasActivity={records.length > 0}
    />
  );
}
