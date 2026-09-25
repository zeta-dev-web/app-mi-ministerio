import { z } from "zod";

export const ministryRecordSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)."),
    startMinute: z.number().int().min(0).max(1439).nullable().optional(),
    endMinute: z.number().int().min(1).max(1440).nullable().optional(),
    manualHours: z.number().int().min(0).max(24).nullable().optional(),
    manualMinutes: z.number().int().nullable().optional().refine(
      (v) => v == null || [0, 15, 30, 45].includes(v),
      { message: "Los minutos deben ser 00, 15, 30 o 45." }
    ),
    ministryTypeId: z.string().min(1, "Elegí el tipo de ministerio."),
    didStudy: z.boolean().default(false),
    didVisit: z.boolean().default(false),
    personIds: z.array(z.string()).default([]),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    const hasManual = v.manualHours != null && v.manualMinutes != null;
    if (hasManual) return; // en modo manual no se exige inicio/fin
    if (v.startMinute == null || v.endMinute == null) {
      ctx.addIssue({ code: "custom", message: "Indicá inicio y fin, o cargá las horas manualmente.", path: ["endMinute"] });
      return;
    }
    if (v.endMinute <= v.startMinute) {
      ctx.addIssue({ code: "custom", message: "La hora de fin debe ser posterior a la de inicio, dentro del mismo día.", path: ["endMinute"] });
    }
  })
  .refine(
    (v) => {
      // Estudio exige al menos una persona; visita sola permite 0..N.
      if (v.didStudy) return v.personIds.length >= 1;
      return true;
    },
    { message: "Un estudio requiere vincular al menos una persona.", path: ["personIds"] }
  )
  .refine(
    (v) => {
      if (!v.didStudy && !v.didVisit) return v.personIds.length === 0;
      return true;
    },
    { message: "Solo se pueden vincular personas si marcás estudio o visita.", path: ["personIds"] }
  );

export type MinistryRecordInput = z.infer<typeof ministryRecordSchema>;

export const ministryTypeSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(60),
  active: z.boolean().default(true),
});

export const personStatusSchema = z.enum(["revisita", "curso", "no_en_casa", "no_visitar", "archivado"]);

export const interestedPersonSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio.").max(80),
  lastName: z.string().trim().max(80).nullable().optional(),
  territory: z.string().trim().max(80).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email("Email inválido.").max(120).nullable().optional().or(z.literal("")),
  age: z.number().int().min(0).max(130).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: personStatusSchema.default("revisita"),
  language: z.string().trim().max(60).nullable().optional(),
  firstContactDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD).")
    .nullable()
    .optional()
    .or(z.literal("")),
  studyPublication: z.string().trim().max(120).nullable().optional(),
  studyLesson: z.number().int().min(0).max(1000).nullable().optional(),
  studyTotalLessons: z.number().int().min(1).max(1000).nullable().optional(),
  nextVisitDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD).")
    .nullable()
    .optional()
    .or(z.literal("")),
  nextVisitTime: z.string().trim().max(10).nullable().optional(),
  nextTopic: z.string().trim().max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});
