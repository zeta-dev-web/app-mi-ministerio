import { z } from "zod";

/**
 * Valida que sea una zona IANA real (sin abreviaturas ni offsets sueltos).
 * - Exige forma "Área/Localidad" (p. ej. "America/Argentina/Buenos_Aires").
 *   Esto rechaza abreviaturas como "ART"/"EST" (que ICU mapearía a otras
 *   zonas: ART→Africa/Cairo, EST→America/Panama) y offsets como "GMT-3".
 * - Acepta "UTC" exacta (zona real que algunos sistemas reportan sin barra).
 * - Acepta alias con barra ("America/Argentina/Buenos_Aires") porque los
 *   navegadores los envían; al guardar se normaliza a la forma canónica.
 * No se usa Intl.supportedValuesOf como lista cerrada porque en algunos ICU
 * solo trae zonas canónicas y rechazaría alias válidos de navegadores.
 */
const IANA_SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*\/[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/;

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 100) return false;
  if (/^utc$/i.test(tz)) return true;
  if (!IANA_SHAPE.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("es", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Normaliza un alias a su forma canónica según el ICU del servidor. */
export function canonicalTimeZone(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return tz;
  }
}

const pushKeysSchema = z.object({
  p256dh: z.string().min(1, "Falta la clave p256dh.").max(500),
  auth: z.string().min(1, "Falta la clave auth.").max(500),
});

const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .min(1, "Falta el endpoint.")
    .max(2000)
    .refine((v) => v.startsWith("https://"), {
      message: "El endpoint debe ser HTTPS.",
    })
    .refine((v) => {
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }, { message: "Endpoint inválido." }),
  expirationTime: z.number().nullable().optional(),
  keys: pushKeysSchema,
});

export const pushSubscribeSchema = z.object({
  subscription: subscriptionSchema,
  timeZone: z
    .string()
    .min(1, "Falta la zona horaria.")
    .max(100)
    .refine(isValidTimeZone, { message: "Zona horaria inválida." }),
  deviceLabel: z.string().trim().max(120).nullable().optional().or(z.literal("")),
});

export const pushEndpointSchema = z.object({
  endpoint: z.string().min(1, "Falta el endpoint.").max(2000),
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
