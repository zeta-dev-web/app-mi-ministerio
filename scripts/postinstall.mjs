// Postinstall: genera el cliente Prisma y sincroniza los skills de Prisma.
//
// `prisma generate` no abre conexión a la base, pero prisma.config.ts valida
// DATABASE_URL al cargarse y aborta si falta. Para que un clon nuevo (sin .env
// todavía) genere el cliente igual, inyectamos una URL placeholder: el cliente
// generado resuelve DATABASE_URL en runtime, no la compila (ver generated/prisma).
// Sin esto, `pnpm install` en un clon limpio deja el repo sin cliente y el
// primer `pnpm dev` falla con un error de módulo difícil de rastrear.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Invocamos el CLI con el mismo Node (`process.execPath`) en vez del shim
// `node_modules/.bin/prisma`: en Windows ese shim es un .CMD, que spawnSync no
// resuelve sin shell y que no está en PATH fuera de un script de pnpm.
function resolvePrismaCli() {
  const pkgPath = require.resolve("prisma/package.json", { paths: [projectRoot] });
  const bin = JSON.parse(readFileSync(pkgPath, "utf8")).bin;
  const entry = typeof bin === "string" ? bin : bin.prisma;
  if (!entry) throw new Error("No se pudo resolver el entrypoint de prisma desde package.json#bin");
  return path.join(path.dirname(pkgPath), entry);
}

function runPrisma(args, env) {
  return spawnSync(process.execPath, [resolvePrismaCli(), ...args], {
    stdio: "inherit",
    env,
  });
}

const env = { ...process.env };
if (!env.DATABASE_URL) {
  env.DATABASE_URL = "postgresql://localhost:5432/placeholder?schema=public";
  console.log("[postinstall] DATABASE_URL no definida: generando el cliente con una URL placeholder.");
  console.log("[postinstall] Definí DATABASE_URL en .env antes de migrar o correr la app.");
}

const generated = runPrisma(["generate"], env);
if (generated.status !== 0) {
  console.error("[postinstall] `prisma generate` falló. Corré `pnpm db:generate` para ver el error.");
  process.exit(generated.status ?? 1);
}

// `prisma skills sync` es opcional: si falla no debe romper la instalación.
runPrisma(["skills", "sync"], process.env);
