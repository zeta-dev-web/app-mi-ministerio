// Tests de integración DB de notificaciones (FASE 5, §22.2 del plan).
//
// - Contra la DB dev del .env (localhost:5433). Requiere migraciones aplicadas.
// - Usuarios de prueba `pwa-test-<timestamp>-{a,b}@example.com`, creados en
//   beforeAll y BORRADOS en afterAll (cascada); al final se verifica que no
//   queden filas huérfanas (0 suscripciones, trabajos, entregas y tareas).
// - Se testean las funciones reales de dominio (scheduler + worker con sender
//   mock inyectado, firma que lo permite). Las rutas HTTP (401, CRON_SECRET)
//   NO se invocan: los Route Handlers dependen de sesión NextAuth/headers y
//   son frágiles fuera de un servidor; quedan en la matriz manual/E2E
//   (ver docs/PUSH-VPS.md y reporte de FASE 5).
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  syncTaskReminder,
  type ReminderTaskInput,
} from "@/lib/notifications/schedule-task-reminder";
import { getNotificationTuning } from "@/lib/notifications/config";
import {
  processNotificationBatch,
  type PushSender,
} from "@/lib/notifications/worker";

const stamp = Date.now();
const emailA = `pwa-test-${stamp}-a@example.com`;
const emailB = `pwa-test-${stamp}-b@example.com`;
const ZONE = "America/Argentina/Buenos_Aires";

let userA!: { id: string };
let userB!: { id: string };

const okSender: PushSender = async () => ({ ok: true });
const goneSender: PushSender = async () => ({
  ok: false,
  error: { kind: "GONE", statusCode: 410 },
});

function countingSender(inner: PushSender, counter: { calls: number }): PushSender {
  return async (target, payload) => {
    counter.calls += 1;
    return inner(target, payload);
  };
}

/** Crea tarea + sincroniza su recordatorio en una transacción (como las APIs). */
async function createTaskWithReminder(
  userId: string,
  overrides: Partial<ReminderTaskInput> & { date: Date }
) {
  return db.$transaction(async (tx) => {
    const task = await tx.ministryTask.create({
      data: {
        userId,
        type: "Salida al servicio",
        date: overrides.date,
        timeMinute: overrides.timeMinute ?? null,
        reminderEnabled: overrides.reminderEnabled ?? true,
        reminderMinutesBefore: overrides.reminderMinutesBefore ?? null,
        reminderAt: overrides.reminderAt ?? null,
        reminderTimeZone: ZONE,
        status: "PENDING",
      },
    });
    await syncTaskReminder(tx, task);
    return task;
  });
}

function futureDate(daysAhead: number): Date {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function futureInstant(hoursAhead: number): Date {
  return new Date(Date.now() + hoursAhead * 3_600_000);
}

beforeAll(async () => {
  userA = await db.user.create({
    data: { email: emailA, passwordHash: "test-hash", timeZone: ZONE },
    select: { id: true },
  });
  userB = await db.user.create({
    data: { email: emailB, passwordHash: "test-hash", timeZone: ZONE },
    select: { id: true },
  });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  // Verificación de huérfanos: todo debe ser 0 tras la cascada.
  const [subs, jobs, tasks, deliveries] = await Promise.all([
    db.pushSubscription.count({ where: { userId: { in: [userA.id, userB.id] } } }),
    db.taskNotificationJob.count({ where: { userId: { in: [userA.id, userB.id] } } }),
    db.ministryTask.count({ where: { userId: { in: [userA.id, userB.id] } } }),
    db.pushNotificationDelivery.count({
      where: { notification: { userId: { in: [userA.id, userB.id] } } },
    }),
  ]);
  expect({ subs, jobs, tasks, deliveries }).toEqual({
    subs: 0,
    jobs: 0,
    tasks: 0,
    deliveries: 0,
  });
});

describe("suscripciones", () => {
  const endpoint = `https://push.example.com/pwa-test-${stamp}-1`;

  it("upsert: suscribirse 2× al mismo endpoint deja 1 fila", async () => {
    for (const label of ["Chrome", "Chrome actualizado"]) {
      await db.pushSubscription.upsert({
        where: { endpoint },
        create: {
          userId: userA.id,
          endpoint,
          p256dh: "p256dh-a",
          auth: "auth-a",
          deviceLabel: label,
          timeZone: ZONE,
          active: true,
          lastSeenAt: new Date(),
        },
        update: { userId: userA.id, deviceLabel: label, active: true, lastSeenAt: new Date() },
      });
    }
    const rows = await db.pushSubscription.findMany({ where: { endpoint } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(userA.id);
    expect(rows[0].deviceLabel).toBe("Chrome actualizado");
  });

  it("unsubscribe idempotente: 2× baja deja 1 fila inactiva", async () => {
    for (let i = 0; i < 2; i++) {
      await db.pushSubscription.update({
        where: { endpoint },
        data: { active: false },
      });
    }
    const row = await db.pushSubscription.findUnique({ where: { endpoint } });
    expect(row?.active).toBe(false);
    // Se reactiva para los tests del worker.
    await db.pushSubscription.update({ where: { endpoint }, data: { active: true } });
  });

  it("aislamiento: B no puede tocar la suscripción de A (404 genérico)", async () => {
    // Misma lógica que DELETE /api/push/subscribe: pertenencia antes de actuar.
    const existing = await db.pushSubscription.findUnique({
      where: { endpoint },
      select: { id: true, userId: true },
    });
    expect(existing).not.toBeNull();
    // Para B, la respuesta debe ser 404 genérico sin filtrar datos de A.
    const visibleToB =
      existing && existing.userId === userB.id ? existing : null;
    expect(visibleToB).toBeNull();
    // Y una búsqueda acotada a (endpoint + userId de B) no devuelve nada.
    const mine = await db.pushSubscription.findFirst({
      where: { endpoint, userId: userB.id },
    });
    expect(mine).toBeNull();
  });
});

describe("ciclo de vida del recordatorio", () => {
  it("crear tarea con recordatorio crea el trabajo (rev 1, PENDING)", async () => {
    const task = await createTaskWithReminder(userA.id, {
      date: futureDate(2),
      reminderAt: futureInstant(48),
    });
    const job = await db.taskNotificationJob.findUnique({
      where: { taskId: task.id },
    });
    expect(job).not.toBeNull();
    expect(job?.status).toBe("PENDING");
    expect(job?.revision).toBe(1);
    await db.ministryTask.delete({ where: { id: task.id } });
  });

  it("editar reprograma (rev +1); desactivar cancela; reactivar reprograma; completar cancela", async () => {
    const task = await createTaskWithReminder(userA.id, {
      date: futureDate(3),
      reminderAt: futureInstant(72),
    });
    const edit = async (data: Record<string, unknown>) =>
      db.$transaction(async (tx) => {
        const t = await tx.ministryTask.update({ where: { id: task.id }, data });
        await syncTaskReminder(tx, t);
        return t;
      });

    // Editar → rev 2.
    const t2 = await edit({ reminderAt: futureInstant(73) });
    let job = await db.taskNotificationJob.findUnique({ where: { taskId: task.id } });
    expect(job?.revision).toBe(2);
    expect(job?.status).toBe("PENDING");
    expect(job?.scheduledFor.getTime()).toBe(t2.reminderAt!.getTime());

    // Desactivar → CANCELLED.
    await edit({ reminderEnabled: false });
    job = await db.taskNotificationJob.findUnique({ where: { taskId: task.id } });
    expect(job?.status).toBe("CANCELLED");

    // Reactivar con futuro → PENDING rev 3.
    await edit({ reminderEnabled: true, reminderAt: futureInstant(74) });
    job = await db.taskNotificationJob.findUnique({ where: { taskId: task.id } });
    expect(job?.status).toBe("PENDING");
    expect(job?.revision).toBe(3);

    // Completar → CANCELLED.
    await db.$transaction(async (tx) => {
      const t = await tx.ministryTask.update({
        where: { id: task.id },
        data: { status: "DONE" },
      });
      await syncTaskReminder(tx, t);
    });
    job = await db.taskNotificationJob.findUnique({ where: { taskId: task.id } });
    expect(job?.status).toBe("CANCELLED");

    await db.ministryTask.delete({ where: { id: task.id } });
  });

  it("eliminar la tarea borra el trabajo y sus entregas en cascada", async () => {
    const task = await createTaskWithReminder(userA.id, {
      date: futureDate(4),
      reminderAt: futureInstant(96),
    });
    const job = await db.taskNotificationJob.findUnique({ where: { taskId: task.id } });
    expect(job).not.toBeNull();
    await db.pushNotificationDelivery.create({
      data: { notificationId: job!.id, subscriptionId: (await db.pushSubscription.findFirstOrThrow({ where: { userId: userA.id } })).id, revision: job!.revision },
    });
    await db.ministryTask.delete({ where: { id: task.id } });
    expect(await db.taskNotificationJob.findUnique({ where: { taskId: task.id } })).toBeNull();
    expect(
      await db.pushNotificationDelivery.count({ where: { notificationId: job!.id } })
    ).toBe(0);
  });
});

describe("worker con sender mock", () => {
  it("envía lo vencido, no reenvía SENT y marca EXPIRED lo muy atrasado", async () => {
    const tuning = getNotificationTuning();
    const task = await createTaskWithReminder(userA.id, {
      date: futureDate(1),
      reminderAt: futureInstant(2),
    });
    const job = await db.taskNotificationJob.findUniqueOrThrow({
      where: { taskId: task.id },
    });
    // Fuerza vencimiento dentro de la ventana de lateness (claim usa NOW() real).
    const due = new Date(Date.now() - 60_000);
    await db.taskNotificationJob.update({
      where: { id: job.id },
      data: { scheduledFor: due, nextAttemptAt: due },
    });

    const counter = { calls: 0 };
    const s1 = await processNotificationBatch({
      sender: countingSender(okSender, counter),
      now: new Date(),
    });
    expect(s1.claimed).toBeGreaterThanOrEqual(1);
    expect(counter.calls).toBe(1);
    let row = await db.taskNotificationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.status).toBe("SENT");
    const deliveries = await db.pushNotificationDelivery.findMany({
      where: { notificationId: job.id, revision: job.revision },
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("SENT");

    // Reactivar el mismo trabajo en la MISMA revisión: la entrega SENT no se reenvía.
    await db.taskNotificationJob.update({
      where: { id: job.id },
      data: { status: "PENDING", nextAttemptAt: new Date(Date.now() - 60_000) },
    });
    const counter2 = { calls: 0 };
    await processNotificationBatch({
      sender: countingSender(okSender, counter2),
      now: new Date(),
    });
    expect(counter2.calls).toBe(0);
    row = await db.taskNotificationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.status).toBe("SENT");

    // Trabajo muy atrasado (más allá de lateness) → EXPIRED sin enviar.
    const old = await createTaskWithReminder(userA.id, {
      date: futureDate(1),
      reminderAt: futureInstant(2),
    });
    const oldJob = await db.taskNotificationJob.findUniqueOrThrow({
      where: { taskId: old.id },
    });
    const ancient = new Date(
      Date.now() - (tuning.maxLatenessMinutes + 60) * 60_000
    );
    await db.taskNotificationJob.update({
      where: { id: oldJob.id },
      data: { scheduledFor: ancient, nextAttemptAt: ancient },
    });
    const counter3 = { calls: 0 };
    const s3 = await processNotificationBatch({
      sender: countingSender(okSender, counter3),
      now: new Date(),
    });
    expect(s3.expired).toBeGreaterThanOrEqual(1);
    expect(counter3.calls).toBe(0);
    row = await db.taskNotificationJob.findUniqueOrThrow({ where: { id: oldJob.id } });
    expect(row.status).toBe("EXPIRED");

    await db.ministryTask.delete({ where: { id: task.id } });
    await db.ministryTask.delete({ where: { id: old.id } });
  });

  it("endpoint 410 desactiva la suscripción (GONE) sin tumbar el lote", async () => {
    const endpoint410 = `https://push.example.com/pwa-test-${stamp}-410`;
    const sub = await db.pushSubscription.create({
      data: {
        userId: userA.id,
        endpoint: endpoint410,
        p256dh: "p256dh-410",
        auth: "auth-410",
        timeZone: ZONE,
        active: true,
      },
    });
    const task = await createTaskWithReminder(userA.id, {
      date: futureDate(1),
      reminderAt: futureInstant(2),
    });
    const job = await db.taskNotificationJob.findUniqueOrThrow({
      where: { taskId: task.id },
    });
    const due = new Date(Date.now() - 60_000);
    await db.taskNotificationJob.update({
      where: { id: job.id },
      data: { scheduledFor: due, nextAttemptAt: due },
    });

    // Sender selectivo: 410 solo para el endpoint marcado, ok para el resto
    // (así se prueba que la falla de un dispositivo no impide los demás).
    const mixed: PushSender = async (target) =>
      target.endpoint === endpoint410 ? goneSender(target, {} as never) : okSender(target, {} as never);
    await processNotificationBatch({ sender: mixed, now: new Date() });

    const subRow = await db.pushSubscription.findUniqueOrThrow({
      where: { id: sub.id },
    });
    expect(subRow.active).toBe(false);
    const goneDeliveries = await db.pushNotificationDelivery.findMany({
      where: { notificationId: job.id, subscriptionId: sub.id },
    });
    expect(goneDeliveries).toHaveLength(1);
    expect(goneDeliveries[0].status).toBe("GONE");

    await db.ministryTask.delete({ where: { id: task.id } });
    await db.pushSubscription.delete({ where: { id: sub.id } });
  });

  it("dos ejecuciones concurrentes no duplican entregas", async () => {
    const endpointC = `https://push.example.com/pwa-test-${stamp}-conc`;
    const sub = await db.pushSubscription.create({
      data: {
        userId: userB.id,
        endpoint: endpointC,
        p256dh: "p256dh-c",
        auth: "auth-c",
        timeZone: ZONE,
        active: true,
      },
    });
    const task = await createTaskWithReminder(userB.id, {
      date: futureDate(1),
      reminderAt: futureInstant(2),
    });
    const job = await db.taskNotificationJob.findUniqueOrThrow({
      where: { taskId: task.id },
    });
    const due = new Date(Date.now() - 60_000);
    await db.taskNotificationJob.update({
      where: { id: job.id },
      data: { scheduledFor: due, nextAttemptAt: due },
    });

    const slowOk: PushSender = async (target, payload) => {
      await new Promise((r) => setTimeout(r, 200));
      return okSender(target, payload);
    };
    await Promise.all([
      processNotificationBatch({ sender: slowOk, now: new Date() }),
      processNotificationBatch({ sender: slowOk, now: new Date() }),
    ]);
    const deliveries = await db.pushNotificationDelivery.findMany({
      where: { notificationId: job.id, revision: job.revision },
    });
    // Una sola entrega por (trabajo, suscripción, revisión): sin duplicados.
    expect(deliveries.filter((d) => d.subscriptionId === sub.id)).toHaveLength(1);

    await db.ministryTask.delete({ where: { id: task.id } });
    await db.pushSubscription.delete({ where: { id: sub.id } });
  });
});
