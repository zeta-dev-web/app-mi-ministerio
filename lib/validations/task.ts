import { z } from "zod";

export const REMINDER_OPTIONS = [
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 h antes" },
  { value: 120, label: "2 h antes" },
  { value: 1440, label: "1 día antes" },
] as const;

export const TASK_TYPE_SUGGESTIONS = [
  "Discurso: Tesoros de la Biblia (10 minutos)",
  "Busquemos Perlas Escondidas",
  "Lectura de la Biblia",
  "Asignación de estudiantes",
  "Nuestra vida cristiana (15 minutos)",
  "Discurso público (30 minutos)",
  "Estudio de La Atalaya",
  "Estudio bíblico de congregación",
  "Necesidades de la congregación",
  "Presidencia de la reunión",
  "Oración inicial",
  "Oración final",
  "Reunión para el servicio del campo",
  "Reunión de grupo para el servicio",
  "Lector",
  "Micrófono",
  "Sonido",
  "Acomodador",
  "Limpieza",
  "Mantenimiento",
  "Tareas personalizadas",
] as const;

export const ministryTaskSchema = z.object({
  type: z.string().trim().min(1, "El tipo es obligatorio.").max(80),
  topic: z.string().trim().max(160).nullable().optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)."),
  timeMinute: z.number().int().min(0).max(1439).nullable().optional(),
  notes: z.string().max(2000).nullable().optional().or(z.literal("")),
  reminderEnabled: z.boolean().default(false),
  reminderMinutesBefore: z.number().int().nullable().optional().refine(
    (v) => v == null || [15, 30, 60, 120, 1440].includes(v),
    { message: "Anticipación inválida." }
  ),
  reminderAt: z.string().datetime().nullable().optional(),
  // Zona IANA del cliente (FASE 3, §5.6/§6): opcional; si es válida se usa
  // para calcular el recordatorio y se guarda en reminderTimeZone. Si es
  // inválida se ignora y se usa la zona del usuario. Sin refine estricto acá
  // para no romper clientes existentes: la valida el programador.
  timeZone: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING", "DONE"]).default("PENDING"),
});

export type MinistryTaskInput = z.infer<typeof ministryTaskSchema>;
