// Tests unitarios de clasificación de errores Web Push (§15.4, FASE 5 §22.1).
// `classifyPushError` ya es un export testeable de lib/notifications/web-push.ts
// (no hizo falta editar el módulo).
import { describe, expect, it } from "vitest";
import { classifyPushError } from "@/lib/notifications/web-push";

describe("classifyPushError", () => {
  it("404/410 → GONE (desactivar suscripción)", () => {
    expect(classifyPushError({ statusCode: 404 })).toMatchObject({ kind: "GONE" });
    expect(classifyPushError({ statusCode: 410 })).toMatchObject({ kind: "GONE" });
  });

  it("429 y 5xx → RETRYABLE (backoff)", () => {
    for (const code of [429, 500, 502, 503]) {
      expect(classifyPushError({ statusCode: code }).kind).toBe("RETRYABLE");
    }
  });

  it("otros 4xx → PERMANENT (no reintentar indefinidamente)", () => {
    for (const code of [400, 401, 403, 413]) {
      expect(classifyPushError({ statusCode: code }).kind).toBe("PERMANENT");
    }
  });

  it("sin status (red/timeout) → RETRYABLE y nunca filtra secretos", () => {
    const r = classifyPushError(new Error("socket hang up"));
    expect(r.kind).toBe("RETRYABLE");
    expect(JSON.stringify(r)).not.toMatch(/https?:\/\//);
  });
});
