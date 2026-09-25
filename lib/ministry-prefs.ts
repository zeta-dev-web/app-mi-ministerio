import { db } from "@/lib/db";

/** Tipos globales habilitados por defecto: solo Servicio. El resto se habilita en Configuración. */
export const DEFAULT_DISABLED_MINISTRY_TYPES = ["CEH", "Capacitación/Cursos", "GVP", "Discursos"];

export async function effectiveDisabledTypes(userId: string): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { disabledMinistryTypes: true, ministryTypesConfigured: true },
  });
  if (!user || !user.ministryTypesConfigured) return DEFAULT_DISABLED_MINISTRY_TYPES;
  return user.disabledMinistryTypes;
}
