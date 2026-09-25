// Validación de URL interna para notificationclick (FASE 5, §22.1).
//
// NOTA DE SINCRONÍA: `public/sw.js` es vanilla sin bundler y NO puede
// importar este módulo. La lógica mínima (`sanitizeClickUrl`) está DUPLICADA
// en `public/sw.js` como `toSafeUrl()`. Si se cambia la regla acá, cambiarla
// también allá (y viceversa) y correr `pnpm test`.
//
// Regla (§10 del plan): solo rutas internas que empiezan con `/`.
// Se rechazan esquemas/hosts externos (`https://...`, `javascript:...`) y
// las URLs `//host/...` (que el navegador interpreta como mismo-esquema
// externo). Todo lo inválido cae a `/tareas`.

export const SAFE_CLICK_URL_FALLBACK = "/tareas";

/** Devuelve una ruta interna segura o el fallback `/tareas`. */
export function sanitizeClickUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return SAFE_CLICK_URL_FALLBACK;
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return SAFE_CLICK_URL_FALLBACK;
  }
  return value;
}
