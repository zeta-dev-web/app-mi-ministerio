import { z } from "zod";

const dateOrEmpty = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD).")
  .nullable()
  .optional()
  .or(z.literal(""));

const recipientPhoneSchema = z
  .string()
  .trim()
  .max(20, "El teléfono del destinatario no puede superar 20 caracteres.")
  .regex(/^[+\d][\d\s-]*$/, "Teléfono del destinatario inválido (solo dígitos, +, espacios y guiones).")
  .nullable()
  .optional()
  .or(z.literal(""));

export const profileSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(80),
  phone: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  congregation: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  baptismDate: dateOrEmpty,
  publisherSince: dateOrEmpty,
  personalGoalHours: z.number().int().min(0).max(300).nullable().optional(),
  annualGoalHours: z.number().int().min(0).max(3600).nullable().optional(),
  serviceRoleId: z.string().min(1).nullable().optional(),
  recipientName: z.string().trim().max(80).nullable().optional().or(z.literal("")),
  recipientPhone: recipientPhoneSchema,
  carryMinutes: z.boolean().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
