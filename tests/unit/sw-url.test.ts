// Tests unitarios de validación de URL interna del SW (FASE 5 §22.1).
// Se testea `lib/sw-url.ts`, duplicado mínimo de `toSafeUrl()` de public/sw.js
// (el SW es vanilla sin bundler; ver nota de sincronía en el módulo).
import { describe, expect, it } from "vitest";
import { sanitizeClickUrl } from "@/lib/sw-url";

describe("sanitizeClickUrl", () => {
  it("acepta rutas internas", () => {
    expect(sanitizeClickUrl("/tareas?task=abc")).toBe("/tareas?task=abc");
    expect(sanitizeClickUrl("/tareas")).toBe("/tareas");
    expect(sanitizeClickUrl("/")).toBe("/");
  });

  it("rechaza URLs externas, protocol-relative y esquemas", () => {
    for (const evil of [
      "https://evil.com/tareas",
      "http://evil.com",
      "//evil.com/tareas",
      "javascript:alert(1)",
      "data:text/html,<h1>x</h1>",
    ]) {
      expect(sanitizeClickUrl(evil)).toBe("/tareas");
    }
  });

  it("rechaza valores vacíos / no-string con el fallback", () => {
    for (const bad of ["", null, undefined, 42, {}, ["/tareas"]]) {
      expect(sanitizeClickUrl(bad)).toBe("/tareas");
    }
  });
});
