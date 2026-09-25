import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client";

const SERVICE_ROLES = [
  { code: "PUBLICADOR", label: "Publicador", monthlyQuota: null, sortOrder: 0 },
  { code: "BETELITA", label: "Betelita", monthlyQuota: null, sortOrder: 1 },
  { code: "AUX_15", label: "Precursor auxiliar de 15 horas", monthlyQuota: 15, sortOrder: 2 },
  { code: "AUX_30", label: "Precursor auxiliar de 30 horas", monthlyQuota: 30, sortOrder: 3 },
  { code: "SUP_CIRCUITO_50", label: "Superintendente de circuito de 50 horas", monthlyQuota: 50, sortOrder: 4 },
  { code: "REGULAR_50", label: "Precursor regular de 50 horas", monthlyQuota: 50, sortOrder: 5 },
  { code: "ESPECIAL_90", label: "Precursor especial de 90 horas", monthlyQuota: 90, sortOrder: 6 },
  { code: "ESPECIAL_100", label: "Precursor especial de 100 horas", monthlyQuota: 100, sortOrder: 7 },
  { code: "MISIONERO_90", label: "Misionero de 90 horas", monthlyQuota: 90, sortOrder: 8 },
  { code: "MISIONERO_100", label: "Misionero de 100 horas", monthlyQuota: 100, sortOrder: 9 },
] as const;

const GLOBAL_MINISTRY_TYPES = [
  { name: "Servicio", isDefault: true, sortOrder: 0 },
  { name: "CEH", isDefault: false, sortOrder: 1 },
  { name: "Capacitación/Cursos", isDefault: false, sortOrder: 2 },
  { name: "GVP", isDefault: false, sortOrder: 3 },
  { name: "Discursos", isDefault: false, sortOrder: 4 },
] as const;

type Testament = "HEBREW" | "GREEK";

// Catálogo completo: 66 libros, 1189 capítulos (929 + 260). Se verifica abajo.
const BIBLE_BOOKS: { name: string; testament: Testament; chapters: number }[] = [
  { name: "Génesis", testament: "HEBREW", chapters: 50 },
  { name: "Éxodo", testament: "HEBREW", chapters: 40 },
  { name: "Levítico", testament: "HEBREW", chapters: 27 },
  { name: "Números", testament: "HEBREW", chapters: 36 },
  { name: "Deuteronomio", testament: "HEBREW", chapters: 34 },
  { name: "Josué", testament: "HEBREW", chapters: 24 },
  { name: "Jueces", testament: "HEBREW", chapters: 21 },
  { name: "Rut", testament: "HEBREW", chapters: 4 },
  { name: "1 Samuel", testament: "HEBREW", chapters: 31 },
  { name: "2 Samuel", testament: "HEBREW", chapters: 24 },
  { name: "1 Reyes", testament: "HEBREW", chapters: 22 },
  { name: "2 Reyes", testament: "HEBREW", chapters: 25 },
  { name: "1 Crónicas", testament: "HEBREW", chapters: 29 },
  { name: "2 Crónicas", testament: "HEBREW", chapters: 36 },
  { name: "Esdras", testament: "HEBREW", chapters: 10 },
  { name: "Nehemías", testament: "HEBREW", chapters: 13 },
  { name: "Ester", testament: "HEBREW", chapters: 10 },
  { name: "Job", testament: "HEBREW", chapters: 42 },
  { name: "Salmos", testament: "HEBREW", chapters: 150 },
  { name: "Proverbios", testament: "HEBREW", chapters: 31 },
  { name: "Eclesiastés", testament: "HEBREW", chapters: 12 },
  { name: "Cantares", testament: "HEBREW", chapters: 8 },
  { name: "Isaías", testament: "HEBREW", chapters: 66 },
  { name: "Jeremías", testament: "HEBREW", chapters: 52 },
  { name: "Lamentaciones", testament: "HEBREW", chapters: 5 },
  { name: "Ezequiel", testament: "HEBREW", chapters: 48 },
  { name: "Daniel", testament: "HEBREW", chapters: 12 },
  { name: "Oseas", testament: "HEBREW", chapters: 14 },
  { name: "Joel", testament: "HEBREW", chapters: 3 },
  { name: "Amós", testament: "HEBREW", chapters: 9 },
  { name: "Abdías", testament: "HEBREW", chapters: 1 },
  { name: "Jonás", testament: "HEBREW", chapters: 4 },
  { name: "Miqueas", testament: "HEBREW", chapters: 7 },
  { name: "Nahúm", testament: "HEBREW", chapters: 3 },
  { name: "Habacuc", testament: "HEBREW", chapters: 3 },
  { name: "Sofonías", testament: "HEBREW", chapters: 3 },
  { name: "Hageo", testament: "HEBREW", chapters: 2 },
  { name: "Zacarías", testament: "HEBREW", chapters: 14 },
  { name: "Malaquías", testament: "HEBREW", chapters: 4 },
  { name: "Mateo", testament: "GREEK", chapters: 28 },
  { name: "Marcos", testament: "GREEK", chapters: 16 },
  { name: "Lucas", testament: "GREEK", chapters: 24 },
  { name: "Juan", testament: "GREEK", chapters: 21 },
  { name: "Hechos", testament: "GREEK", chapters: 28 },
  { name: "Romanos", testament: "GREEK", chapters: 16 },
  { name: "1 Corintios", testament: "GREEK", chapters: 16 },
  { name: "2 Corintios", testament: "GREEK", chapters: 13 },
  { name: "Gálatas", testament: "GREEK", chapters: 6 },
  { name: "Efesios", testament: "GREEK", chapters: 6 },
  { name: "Filipenses", testament: "GREEK", chapters: 4 },
  { name: "Colosenses", testament: "GREEK", chapters: 4 },
  { name: "1 Tesalonicenses", testament: "GREEK", chapters: 5 },
  { name: "2 Tesalonicenses", testament: "GREEK", chapters: 3 },
  { name: "1 Timoteo", testament: "GREEK", chapters: 6 },
  { name: "2 Timoteo", testament: "GREEK", chapters: 4 },
  { name: "Tito", testament: "GREEK", chapters: 3 },
  { name: "Filemón", testament: "GREEK", chapters: 1 },
  { name: "Hebreos", testament: "GREEK", chapters: 13 },
  { name: "Santiago", testament: "GREEK", chapters: 5 },
  { name: "1 Pedro", testament: "GREEK", chapters: 5 },
  { name: "2 Pedro", testament: "GREEK", chapters: 3 },
  { name: "1 Juan", testament: "GREEK", chapters: 5 },
  { name: "2 Juan", testament: "GREEK", chapters: 1 },
  { name: "3 Juan", testament: "GREEK", chapters: 1 },
  { name: "Judas", testament: "GREEK", chapters: 1 },
  { name: "Apocalipsis", testament: "GREEK", chapters: 22 },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const r of SERVICE_ROLES) {
      await prisma.serviceRole.upsert({
        where: { code: r.code },
        update: { label: r.label, monthlyQuota: r.monthlyQuota, sortOrder: r.sortOrder, active: true },
        create: { code: r.code, label: r.label, monthlyQuota: r.monthlyQuota, sortOrder: r.sortOrder, active: true },
      });
    }
    for (const t of GLOBAL_MINISTRY_TYPES) {
      const existing = await prisma.ministryType.findFirst({
        where: { userId: null, name: t.name },
      });
      if (!existing) {
        await prisma.ministryType.create({
          data: { userId: null, name: t.name, isDefault: t.isDefault, active: true, sortOrder: t.sortOrder },
        });
      } else if (t.isDefault && !existing.isDefault) {
        await prisma.ministryType.update({
          where: { id: existing.id },
          data: { isDefault: true },
        });
      }
    }
    console.log("Seed OK: roles y tipos globales");

    const hebrew = BIBLE_BOOKS.filter((b) => b.testament === "HEBREW").reduce((a, b) => a + b.chapters, 0);
    const greek = BIBLE_BOOKS.filter((b) => b.testament === "GREEK").reduce((a, b) => a + b.chapters, 0);
    if (BIBLE_BOOKS.length !== 66 || hebrew !== 929 || greek !== 260) {
      throw new Error(`Catálogo bíblico inválido: ${BIBLE_BOOKS.length} libros, ${hebrew}+${greek} capítulos.`);
    }
    for (const [i, b] of BIBLE_BOOKS.entries()) {
      await prisma.bibleBook.upsert({
        where: { name: b.name },
        update: { testament: b.testament, chapters: b.chapters, sortOrder: i },
        create: { name: b.name, testament: b.testament, chapters: b.chapters, sortOrder: i },
      });
    }
    console.log("Seed OK: 66 libros bíblicos (1189 capítulos)");

    // Admin inicial: solo si no hay ningún usuario.
    // Credenciales por env (ver .env). En producción definir valores propios.
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const email = (process.env.ADMIN_EMAIL ?? "admin@mi-ministerio.local").toLowerCase().trim();
      const password = process.env.ADMIN_PASSWORD ?? "Admin12345";
      const name = process.env.ADMIN_NAME ?? "Administrador";
      if (!process.env.ADMIN_PASSWORD) {
        console.warn("Seed: ADMIN_PASSWORD no definido, usando clave de desarrollo. Cambiarla luego en producción.");
      }
      const publicador = await prisma.serviceRole.findUnique({ where: { code: "PUBLICADOR" } });
      await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(password, 12),
          name,
          role: "ADMIN",
          serviceRoleId: publicador?.id,
        },
      });
      console.log(`Seed OK: admin creado (${email})`);
    } else {
      console.log(`Seed: ya hay ${userCount} usuario(s), no se crea admin.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
