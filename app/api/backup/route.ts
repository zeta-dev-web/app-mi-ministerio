import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { FEATURES } from "@/lib/features";

function backupDisabled() {
  return NextResponse.json({ error: "Función deshabilitada." }, { status: 403 });
}

const BACKUP_VERSION = 1;

// ---------- Esquemas de validación mínima para restaurar ----------

const profileBackupSchema = z.object({
  name: z.string().max(80).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  congregation: z.string().max(120).nullable().optional(),
  baptismDate: z.string().nullable().optional(),
  publisherSince: z.string().nullable().optional(),
  personalGoalHours: z.number().int().min(0).max(300).nullable().optional(),
  annualGoalHours: z.number().int().min(0).max(3600).nullable().optional(),
  serviceRoleId: z.string().nullable().optional(),
  serviceRoleCode: z.string().nullable().optional(),
  recipientName: z.string().max(80).nullable().optional(),
  recipientPhone: z.string().max(20).nullable().optional(),
  disabledMinistryTypes: z.array(z.string().max(60)).max(50).optional(),
  ministryTypesConfigured: z.boolean().optional(),
});

const ownedSchema = z.object({
  id: z.string().optional(),
  userId: z.string().nullable().optional(),
});

const ministryTypeBackupSchema = ownedSchema.extend({
  name: z.string().trim().min(1).max(60),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const personBackupSchema = ownedSchema.extend({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().max(80).nullable().optional(),
  territory: z.string().max(120).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(120).nullable().optional(),
  age: z.number().int().min(0).max(130).nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().max(20).optional(),
  language: z.string().max(40).nullable().optional(),
  firstContactDate: z.string().nullable().optional(),
  studyPublication: z.string().max(120).nullable().optional(),
  studyLesson: z.number().int().nullable().optional(),
  studyTotalLessons: z.number().int().nullable().optional(),
  nextVisitDate: z.string().nullable().optional(),
  nextVisitTime: z.string().max(10).nullable().optional(),
  nextTopic: z.string().max(200).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

const recordBackupSchema = ownedSchema.extend({
  date: z.string().min(1),
  startMinute: z.number().int().nullable().optional(),
  endMinute: z.number().int().nullable().optional(),
  manualHours: z.number().int().nullable().optional(),
  manualMinutes: z.number().int().nullable().optional(),
  minutes: z.number().int().min(0),
  ministryTypeId: z.string().min(1),
  didStudy: z.boolean().optional(),
  didVisit: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  personIds: z.array(z.string()).max(100).optional(),
});

const taskBackupSchema = ownedSchema.extend({
  type: z.string().trim().min(1).max(120),
  topic: z.string().max(200).nullable().optional(),
  date: z.string().min(1),
  timeMinute: z.number().int().min(0).max(1439).nullable().optional(),
  notes: z.string().nullable().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderMinutesBefore: z.number().int().nullable().optional(),
  status: z.enum(["PENDING", "DONE"]).optional(),
  doneAt: z.string().nullable().optional(),
});

const readingBackupSchema = ownedSchema.extend({
  bookId: z.string().min(1),
  chapter: z.number().int().min(1),
  readAt: z.string().min(1),
});

const reportBackupSchema = ownedSchema.extend({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  submittedAt: z.string().nullable().optional(),
});

const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  profile: profileBackupSchema.optional(),
  ministryTypes: z.array(ministryTypeBackupSchema).max(200).optional(),
  persons: z.array(personBackupSchema).max(2000).optional(),
  records: z.array(recordBackupSchema).max(5000).optional(),
  tasks: z.array(taskBackupSchema).max(2000).optional(),
  readings: z.array(readingBackupSchema).max(2000).optional(),
  reports: z.array(reportBackupSchema).max(200).optional(),
});

function toISODateOnly(v: Date | null): string | null {
  return v ? v.toISOString().slice(0, 10) : null;
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function belongsTo(item: { userId?: string | null }, userId: string): boolean {
  // Ignora ids ajenos: si trae userId y no coincide, se descarta.
  return item.userId == null || item.userId === userId;
}

// ---------- GET: descargar copia completa (sin passwordHash) ----------

export async function GET() {
  if (!FEATURES.backup) return backupDisabled();
  const { userId } = await requireUser();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      phone: true,
      congregation: true,
      baptismDate: true,
      publisherSince: true,
      personalGoalHours: true,
      annualGoalHours: true,
      serviceRoleId: true,
      recipientName: true,
      recipientPhone: true,
      disabledMinistryTypes: true,
      ministryTypesConfigured: true,
      serviceRole: { select: { code: true } },
      ministryTypes: true,
      interestedPeople: true,
      ministryRecords: { include: { people: { select: { personId: true } } } },
      ministryTasks: true,
      bibleReadings: true,
      ministryReports: true,
    },
  });
  if (!user) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      name: user.name,
      phone: user.phone,
      congregation: user.congregation,
      baptismDate: toISODateOnly(user.baptismDate),
      publisherSince: toISODateOnly(user.publisherSince),
      personalGoalHours: user.personalGoalHours,
      annualGoalHours: user.annualGoalHours,
      serviceRoleId: user.serviceRoleId,
      serviceRoleCode: user.serviceRole?.code ?? null,
      recipientName: user.recipientName,
      recipientPhone: user.recipientPhone,
      disabledMinistryTypes: user.disabledMinistryTypes,
      ministryTypesConfigured: user.ministryTypesConfigured,
    },
    ministryTypes: user.ministryTypes.map((t) => ({ ...t, userId })),
    persons: user.interestedPeople.map((p) => ({ ...p, userId })),
    records: user.ministryRecords.map((r) => ({
      ...r,
      userId,
      personIds: r.people.map((l) => l.personId),
      people: undefined,
    })),
    tasks: user.ministryTasks.map((t) => ({ ...t, userId })),
    readings: user.bibleReadings.map((r) => ({ ...r, userId })),
    reports: user.ministryReports.map((r) => ({ ...r, userId })),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mi-ministerio-backup-${stamp}.json"`,
    },
  });
}

// ---------- POST: restaurar (borra y reemplaza, en transacción) ----------

export async function POST(req: Request) {
  if (!FEATURES.backup) return backupDisabled();
  const { userId } = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = backupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Archivo de copia inválido." }, { status: 400 });
  }
  const b = parsed.data;

  const result = await db.$transaction(async (tx) => {
    // 1) Borrar datos actuales del usuario (scoped a su userId).
    await tx.ministryRecordPerson.deleteMany({ where: { record: { userId } } });
    await tx.ministryRecord.deleteMany({ where: { userId } });
    await tx.interestedPerson.deleteMany({ where: { userId } });
    await tx.ministryTask.deleteMany({ where: { userId } });
    await tx.bibleReading.deleteMany({ where: { userId } });
    await tx.ministryReport.deleteMany({ where: { userId } });
    await tx.ministryType.deleteMany({ where: { userId } });

    // 2) Perfil (solo si el backup lo trae; reemplazo total de esos campos).
    if (b.profile) {
      const p = b.profile;
      let serviceRoleId: string | null = null;
      if (p.serviceRoleId) {
        const byId = await tx.serviceRole.findUnique({ where: { id: p.serviceRoleId } });
        if (byId) serviceRoleId = byId.id;
      }
      if (!serviceRoleId && p.serviceRoleCode) {
        const byCode = await tx.serviceRole.findUnique({ where: { code: p.serviceRoleCode } });
        if (byCode) serviceRoleId = byCode.id;
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          name: p.name?.trim() ? p.name.trim() : null,
          phone: p.phone?.trim() ? p.phone.trim() : null,
          congregation: p.congregation?.trim() ? p.congregation.trim() : null,
          baptismDate: parseDate(p.baptismDate),
          publisherSince: parseDate(p.publisherSince),
          personalGoalHours: p.personalGoalHours ?? null,
          annualGoalHours: p.annualGoalHours ?? null,
          serviceRoleId,
          recipientName: p.recipientName?.trim() ? p.recipientName.trim() : null,
          recipientPhone: p.recipientPhone?.trim() ? p.recipientPhone.trim() : null,
          disabledMinistryTypes: p.disabledMinistryTypes ?? [],
          ministryTypesConfigured: p.ministryTypesConfigured ?? false,
        },
      });
    }

    // 3) Tipos propios (deduplicados por nombre).
    const typeIdMap = new Map<string, string>();
    const seenNames = new Set<string>();
    let typesCount = 0;
    for (const t of b.ministryTypes ?? []) {
      if (!belongsTo(t, userId)) continue;
      const name = t.name.trim();
      if (!name || seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());
      const created = await tx.ministryType.create({
        data: {
          userId,
          name,
          isDefault: t.isDefault ?? false,
          active: t.active ?? true,
          sortOrder: t.sortOrder ?? 0,
        },
      });
      if (t.id) typeIdMap.set(t.id, created.id);
      typesCount += 1;
    }

    // Tipos globales (no se borran ni se restauran): se conservan sus ids.
    const globalTypes = await tx.ministryType.findMany({ where: { userId: null }, select: { id: true } });
    const globalTypeIds = new Set(globalTypes.map((t) => t.id));
    const ownTypeIds = new Set(typeIdMap.values());

    // 4) Personas.
    const personIdMap = new Map<string, string>();
    let personsCount = 0;
    for (const p of b.persons ?? []) {
      if (!belongsTo(p, userId)) continue;
      const created = await tx.interestedPerson.create({
        data: {
          userId,
          firstName: p.firstName.trim(),
          lastName: p.lastName?.trim() ? p.lastName.trim() : null,
          territory: p.territory ?? null,
          address: p.address ?? null,
          phone: p.phone ?? null,
          email: p.email ?? null,
          age: p.age ?? null,
          notes: p.notes ?? null,
          status: p.status ?? "revisita",
          language: p.language ?? null,
          firstContactDate: parseDate(p.firstContactDate),
          studyPublication: p.studyPublication ?? null,
          studyLesson: p.studyLesson ?? null,
          studyTotalLessons: p.studyTotalLessons ?? null,
          nextVisitDate: parseDate(p.nextVisitDate),
          nextVisitTime: p.nextVisitTime ?? null,
          nextTopic: p.nextTopic ?? null,
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
        },
      });
      if (p.id) personIdMap.set(p.id, created.id);
      personsCount += 1;
    }

    // 5) Registros (con vínculos a personas).
    let recordsCount = 0;
    for (const r of b.records ?? []) {
      if (!belongsTo(r, userId)) continue;
      const date = parseDate(r.date);
      if (!date) continue;
      const ministryTypeId = typeIdMap.get(r.ministryTypeId) ?? r.ministryTypeId;
      if (!ownTypeIds.has(ministryTypeId) && !globalTypeIds.has(ministryTypeId)) continue;
      const personIds = [...new Set(r.personIds ?? [])]
        .map((oldId) => personIdMap.get(oldId))
        .filter((v): v is string => v != null);
      await tx.ministryRecord.create({
        data: {
          userId,
          date,
          startMinute: r.startMinute ?? null,
          endMinute: r.endMinute ?? null,
          manualHours: r.manualHours ?? null,
          manualMinutes: r.manualMinutes ?? null,
          minutes: r.minutes,
          ministryTypeId,
          didStudy: r.didStudy ?? false,
          didVisit: r.didVisit ?? false,
          notes: r.notes ?? null,
          people: { create: personIds.map((personId) => ({ personId })) },
        },
      });
      recordsCount += 1;
    }

    // 6) Tareas.
    let tasksCount = 0;
    for (const t of b.tasks ?? []) {
      if (!belongsTo(t, userId)) continue;
      const date = parseDate(t.date);
      if (!date) continue;
      await tx.ministryTask.create({
        data: {
          userId,
          type: t.type.trim(),
          topic: t.topic ?? null,
          date,
          timeMinute: t.timeMinute ?? null,
          notes: t.notes ?? null,
          reminderEnabled: t.reminderEnabled ?? false,
          reminderMinutesBefore: t.reminderMinutesBefore ?? null,
          status: t.status ?? "PENDING",
          doneAt: parseDate(t.doneAt),
        },
      });
      tasksCount += 1;
    }

    // 7) Lecturas (solo libros existentes del catálogo global).
    const books = await tx.bibleBook.findMany({ select: { id: true } });
    const bookIds = new Set(books.map((x) => x.id));
    let readingsCount = 0;
    const seenReadings = new Set<string>();
    for (const r of b.readings ?? []) {
      if (!belongsTo(r, userId)) continue;
      if (!bookIds.has(r.bookId)) continue;
      const readAt = parseDate(r.readAt);
      if (!readAt) continue;
      const key = `${r.bookId}:${r.chapter}`;
      if (seenReadings.has(key)) continue;
      seenReadings.add(key);
      await tx.bibleReading.create({ data: { userId, bookId: r.bookId, chapter: r.chapter, readAt } });
      readingsCount += 1;
    }

    // 8) Informes (un mes único por usuario).
    let reportsCount = 0;
    const seenMonths = new Set<string>();
    for (const r of b.reports ?? []) {
      if (!belongsTo(r, userId)) continue;
      if (seenMonths.has(r.month)) continue;
      seenMonths.add(r.month);
      await tx.ministryReport.create({
        data: { userId, month: r.month, submittedAt: parseDate(r.submittedAt) },
      });
      reportsCount += 1;
    }

    return {
      types: typesCount,
      persons: personsCount,
      records: recordsCount,
      tasks: tasksCount,
      readings: readingsCount,
      reports: reportsCount,
    };
  });

  return NextResponse.json({ ok: true, restored: result });
}
