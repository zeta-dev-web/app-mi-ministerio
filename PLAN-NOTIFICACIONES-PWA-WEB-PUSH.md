# Plan de implementación: PWA y notificaciones Web Push

**Proyecto:** Mi Ministerio  
**Estado del documento:** listo para implementación  
**Fecha:** 25 de septiembre de 2026  
**Objetivo:** convertir la web actual en una PWA instalable e implementar recordatorios push confiables para las asignaciones, sin crear una aplicación nativa y sin incorporar funcionamiento offline completo.

---

## 1. Instrucciones obligatorias para la IA implementadora

Antes de modificar código:

1. Trabajar únicamente dentro de la aplicación funcional ubicada en `C:\Users\Leo\Documents\APP MI MINISTERIO\app`.
2. Leer completos `AGENTS.md`, `CLAUDE.md`, `package.json`, `prisma/schema.prisma`, `app/tareas/client.tsx`, `app/configuracion/page.tsx`, `app/api/tasks/route.ts`, `app/api/tasks/[id]/route.ts`, `lib/session.ts`, `lib/auth.ts`, `lib/ics.ts`, `app/layout.tsx` y `next.config.ts`.
3. Leer la guía PWA incluida en la versión instalada de Next.js: `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`.
4. Revisar `git status` y preservar todos los cambios existentes. No borrar, reemplazar ni reformatear código ajeno a este alcance.
5. No cambiar la identidad visual, las seis paletas, los modos claro/oscuro, la navegación ni el diseño general. Los componentes nuevos deben usar los tokens CSS existentes (`bg-surface`, `bg-canvas`, `border-line`, `text-muted`, `bg-primary`, etc.).
6. No implementar territorios, lectura de la Biblia, funciones de administrador, mensajería entre usuarios ni una app nativa.
7. No copiar literalmente el ejemplo didáctico de Next.js que guarda una sola suscripción en memoria. Esta aplicación es multiusuario y todas las suscripciones deben persistirse en PostgreSQL y aislarse por usuario.
8. No solicitar permiso de notificaciones al cargar una página. El permiso solo puede pedirse después de una acción explícita del usuario.
9. No cachear con el service worker páginas autenticadas, respuestas de `/api/*`, sesiones ni datos personales. Esta fase continúa siendo online-first.
10. No declarar el trabajo terminado sin migración, pruebas, validaciones y evidencia manual en dispositivos compatibles.

Si durante el desarrollo el código real contradice este documento, detenerse, documentar la contradicción con archivo y línea, y solicitar una decisión antes de cambiar el alcance.

---

## 2. Estado actual confirmado

La aplicación utiliza:

- Next.js 16.3.5 con App Router.
- React 19.2.8 y TypeScript estricto.
- Prisma 6.19.3 con PostgreSQL.
- NextAuth 4 con sesiones JWT y proveedor de credenciales.
- Tailwind CSS 4.
- Usuarios autenticados y datos aislados por `userId`.
- Modos claro y oscuro y seis paletas persistidas en la base de datos.

Las asignaciones ya se guardan en `MinistryTask` y actualmente contienen:

- `date`: fecha calendario.
- `timeMinute`: hora en minutos desde medianoche o `null`.
- `reminderEnabled`: activa o desactiva el recordatorio.
- `reminderMinutesBefore`: anticipación relativa permitida.
- `reminderAt`: fecha/hora personalizada.
- `status`: `PENDING` o `DONE`.

La interfaz ya permite:

- Crear y editar asignaciones.
- Elegir recordatorio relativo de 15, 30, 60, 120 o 1440 minutos.
- Elegir fecha y hora personalizada.
- Exportar la asignación a un archivo ICS con alarma para el calendario del teléfono.

Lo que todavía no existe:

- Web App Manifest.
- Iconos PWA completos.
- Service worker.
- Registro y actualización del service worker.
- Solicitud y administración del permiso de notificaciones.
- Suscripciones Web Push persistidas por usuario y dispositivo.
- Claves VAPID.
- Proceso programado que despache recordatorios.
- Registro idempotente de entregas y reintentos.
- Zona horaria persistida para calcular recordatorios relativos.

Por lo tanto, el interruptor actual de recordatorio guarda configuración y alimenta el archivo ICS, pero todavía no produce una notificación push propia.

---

## 3. Resultado esperado

Al finalizar:

1. Mi Ministerio será instalable como PWA en navegadores compatibles.
2. Un usuario autenticado podrá activar o desactivar notificaciones desde Configuración.
3. Cada navegador o dispositivo tendrá su propia suscripción asociada al mismo usuario.
4. Los recordatorios de asignaciones se enviarán aunque la página no esté abierta.
5. Tocar una notificación abrirá `/tareas` y enfocará la asignación correspondiente.
6. Editar, completar, desactivar el recordatorio o eliminar una asignación impedirá que se envíe una notificación obsoleta.
7. La exportación ICS seguirá funcionando como alternativa independiente.
8. Si el navegador no soporta Web Push, el resto de la aplicación seguirá funcionando normalmente.
9. No será necesaria una aplicación nativa ni publicación en Play Store o App Store.

---

## 4. Alcance y exclusiones

### 4.1 Incluido

- PWA instalable y online-first.
- Manifest e iconos.
- Service worker dedicado a Web Push y apertura de notificaciones.
- Flujo de instalación orientativo para iPhone/iPad.
- Suscripción y desuscripción por dispositivo.
- Envío de notificación de prueba al dispositivo actual.
- Recordatorios push para `MinistryTask`.
- Cálculo correcto de fecha, hora y zona horaria.
- Despachador seguro invocable cada minuto desde un cron del VPS.
- Reintentos limitados, caducidad, limpieza de suscripciones inválidas e idempotencia.
- Estados accesibles en la pantalla Configuración.
- Pruebas unitarias, de integración y manuales.
- Documentación de variables de entorno y despliegue.

### 4.2 Fuera de alcance

- Aplicación Android/iOS nativa.
- Publicación en tiendas.
- Funcionamiento offline de la aplicación.
- Cachear páginas, API o datos del usuario.
- Firebase Cloud Messaging, OneSignal u otro proveedor externo.
- Notificaciones de marketing, publicaciones, personas interesadas o lectura bíblica.
- Panel administrador de notificaciones.
- Notificaciones por correo, SMS o WhatsApp.
- Sincronización en segundo plano de formularios.
- Administración remota del cron del VPS.

---

## 5. Decisiones técnicas cerradas

### 5.1 PWA, no aplicación nativa

Se utilizarán los estándares Web App Manifest, Service Worker, Push API y Notifications API. Next.js soporta este enfoque con el App Router. En iPhone/iPad, Web Push requiere iOS/iPadOS 16.4 o posterior y que la web haya sido añadida a la pantalla de inicio.

### 5.2 Web Push estándar con VAPID

Usar el paquete `web-push` en el servidor y claves VAPID propias. No incorporar Firebase ni servicios SaaS en esta fase.

Dependencias previstas:

```text
web-push
date-fns
date-fns-tz
```

Dependencia de desarrollo prevista:

```text
@types/web-push
```

Antes de instalarlas, verificar las versiones compatibles y la documentación de las versiones efectivamente resueltas por `pnpm`.

### 5.3 Service worker sin caché offline

El service worker manejará solamente:

- `push`;
- `notificationclick`;
- mensajes para aplicar una actualización del propio worker;
- ciclo de instalación/activación necesario.

No debe registrar un manejador `fetch` ni usar Cache Storage durante esta fase. Esto evita servir páginas autenticadas o información personal obsoleta. La PWA seguirá necesitando conexión para utilizar la aplicación.

### 5.4 Múltiples dispositivos

Una cuenta puede tener varias suscripciones activas: teléfono, computadora, otro navegador, etc. El endpoint Web Push identifica una instalación concreta, no al usuario completo.

### 5.5 Privacidad del contenido

La notificación inicial debe ser discreta:

- título: `Mi Ministerio`;
- cuerpo: `Tenés una asignación próxima.`;
- icono y badge de la aplicación;
- enlace profundo a la asignación.

No mostrar notas, nombres de personas interesadas ni otra información sensible en la pantalla bloqueada. Mostrar el tipo o tema de la asignación puede agregarse más adelante como preferencia explícita.

### 5.6 Zona horaria

No asumir que todos los usuarios permanecerán en Argentina. Capturar una zona IANA válida mediante `Intl.DateTimeFormat().resolvedOptions().timeZone`, por ejemplo `America/Argentina/Buenos_Aires`.

Guardar:

- la última zona horaria conocida del usuario;
- la zona utilizada por cada suscripción;
- la zona con la que se calculó el recordatorio de la asignación.

Todos los instantes ejecutables se almacenarán en PostgreSQL como `DateTime`/`timestamptz` en UTC. La zona IANA se conserva como texto para interpretar fechas locales y para auditoría.

---

## 6. Reglas funcionales de recordatorios

### 6.1 Recordatorio relativo

Un recordatorio relativo necesita obligatoriamente:

- fecha de asignación;
- hora concreta (`timeMinute` no nulo);
- anticipación (`reminderMinutesBefore`);
- zona horaria IANA válida.

Si la asignación no tiene hora concreta, la interfaz no debe permitir guardar un recordatorio relativo. Debe ofrecer estas opciones:

1. agregar una hora a la asignación; o
2. elegir un recordatorio personalizado con fecha y hora propias.

No inventar una hora predeterminada en el servidor.

### 6.2 Recordatorio personalizado

`reminderAt` representa un instante explícito elegido por el usuario. El cliente lo enviará como ISO 8601 y el servidor lo validará y normalizará a UTC.

### 6.3 Validaciones

- El recordatorio debe estar en el futuro al momento de crear o editar.
- `reminderMinutesBefore` debe continuar limitado a 15, 30, 60, 120 o 1440.
- La zona debe ser una zona IANA válida; no aceptar abreviaturas como `ART`, `EST` o desplazamientos sueltos.
- Un recordatorio personalizado no puede coexistir con una anticipación relativa activa.
- Una asignación `DONE` no puede conservar un trabajo de notificación pendiente.

### 6.4 Cambios posteriores

- Editar fecha, hora, anticipación, zona o recordatorio personalizado debe reprogramar el trabajo e incrementar su revisión.
- Desactivar el recordatorio debe cancelar el trabajo.
- Marcar la asignación como completada debe cancelar el trabajo.
- Volver una asignación a pendiente no debe reactivar automáticamente un recordatorio ya vencido; debe validarse y programarse de nuevo solamente si todavía es futuro.
- Eliminar la asignación debe eliminar en cascada el trabajo y sus entregas.
- Cambiar tema o notas no debe reprogramar si el instante no cambió.

### 6.5 Retraso máximo

Definir `NOTIFICATION_MAX_LATENESS_MINUTES=30` como valor configurable. Si un trabajo queda pendiente más allá de ese margen, marcarlo `EXPIRED` y no enviar una notificación vieja. No ejecutar recuperaciones ilimitadas después de una caída prolongada.

### 6.6 Idempotencia

Para una combinación de:

- recordatorio;
- suscripción;
- revisión del recordatorio;

solo puede existir una entrega. Ejecutar dos veces el cron o repetir una petición no debe producir notificaciones duplicadas.

---

## 7. Modelo de datos propuesto

Los nombres pueden ajustarse a las convenciones reales, pero no deben perderse las restricciones ni los índices indicados.

### 7.1 Cambios en `User`

Agregar:

```prisma
timeZone             String?
pushSubscriptions    PushSubscription[]
notificationJobs     TaskNotificationJob[]
```

`timeZone` es la última zona conocida y sirve como preferencia general. No establecer silenciosamente una zona por defecto durante la migración.

### 7.2 Cambios en `MinistryTask`

Agregar:

```prisma
reminderTimeZone String?
notificationJob  TaskNotificationJob?
```

Conservar los campos actuales `reminderEnabled`, `reminderMinutesBefore` y `reminderAt` para no romper la UI, el backup ni los ICS.

### 7.3 `PushSubscription`

```prisma
model PushSubscription {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  endpoint    String   @unique @db.Text
  p256dh      String   @db.Text
  auth        String   @db.Text
  userAgent   String?  @db.Text
  deviceLabel String?
  timeZone    String?
  active      Boolean  @default(true)
  lastSeenAt  DateTime @default(now())

  deliveries PushNotificationDelivery[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, active])
}
```

Reglas:

- `endpoint` es globalmente único.
- Una suscripción recibida nuevamente se actualiza mediante `upsert` y se reasocia al usuario autenticado actual.
- Nunca aceptar `userId` desde el cuerpo de la petición.
- Los secretos `p256dh` y `auth` no se muestran en respuestas, logs ni backups.

### 7.4 Estados del trabajo

```prisma
enum NotificationJobStatus {
  PENDING
  PROCESSING
  SENT
  PARTIAL
  FAILED
  CANCELLED
  EXPIRED
  SKIPPED
}
```

### 7.5 `TaskNotificationJob`

```prisma
model TaskNotificationJob {
  id            String                @id @default(cuid())
  taskId        String                @unique
  task          MinistryTask          @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId        String
  user          User                  @relation(fields: [userId], references: [id], onDelete: Cascade)

  scheduledFor  DateTime
  nextAttemptAt DateTime
  revision      Int                   @default(1)
  status        NotificationJobStatus @default(PENDING)
  attempts      Int                   @default(0)
  lockedAt      DateTime?
  processedAt   DateTime?
  lastError     String?               @db.Text

  deliveries PushNotificationDelivery[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, nextAttemptAt])
  @@index([userId])
}
```

Además de los índices Prisma, crear en la migración un índice parcial PostgreSQL para el barrido del worker:

```sql
CREATE INDEX "TaskNotificationJob_due_idx"
ON "TaskNotificationJob" ("nextAttemptAt")
WHERE "status" IN ('PENDING', 'FAILED');
```

Verificar el SQL generado y no duplicar un índice equivalente innecesario.

### 7.6 Estados de entrega

```prisma
enum PushDeliveryStatus {
  PENDING
  SENT
  FAILED
  GONE
}
```

### 7.7 `PushNotificationDelivery`

```prisma
model PushNotificationDelivery {
  id             String             @id @default(cuid())
  notificationId String
  notification   TaskNotificationJob @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  subscriptionId String
  subscription   PushSubscription   @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  revision       Int
  status         PushDeliveryStatus @default(PENDING)
  attempts       Int                @default(0)
  sentAt         DateTime?
  lastAttemptAt  DateTime?
  errorCode      Int?
  errorMessage   String?            @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([notificationId, subscriptionId, revision])
  @@index([subscriptionId])
  @@index([status, lastAttemptAt])
}
```

Todos los campos que sean claves foráneas deben quedar indexados. Revisar la migración SQL, no solamente `schema.prisma`.

---

## 8. Migración y compatibilidad con datos existentes

1. Modificar `prisma/schema.prisma`.
2. Crear una migración Prisma nueva; no editar migraciones ya aplicadas.
3. Revisar el SQL generado, especialmente enums, claves foráneas, cascadas, índices y el índice parcial.
4. Aplicar la migración en desarrollo.
5. Ejecutar `prisma generate` con el comando correspondiente al proyecto.
6. Verificar `prisma migrate status`.

No crear trabajos automáticamente dentro de la migración para recordatorios antiguos, porque los usuarios actuales no tienen una zona horaria confirmada.

Después de que un usuario active las notificaciones:

- guardar su zona horaria;
- ejecutar una reconciliación de sus asignaciones futuras;
- programar recordatorios personalizados futuros;
- programar recordatorios relativos futuros solamente si existe `timeMinute` y una zona válida;
- informar en la UI si alguna asignación con recordatorio necesita una hora o corrección.

Las suscripciones, trabajos y entregas son datos operativos y no deben incluirse en el backup JSON. Los campos funcionales de las asignaciones deben continuar exportándose y restaurándose.

---

## 9. Manifest, iconos y metadatos

Crear `app/manifest.ts` usando `MetadataRoute.Manifest` con al menos:

```text
name: Mi Ministerio
short_name: Mi Ministerio
description: Registro y organización de la actividad ministerial
start_url: /dashboard
scope: /
display: standalone
orientation: any
background_color: color neutro compatible con el diseño
theme_color: color base sobrio de la aplicación
lang: es
id: /
```

Iconos mínimos en `public/icons/`:

- `icon-192x192.png`, propósito `any`;
- `icon-512x512.png`, propósito `any`;
- `icon-maskable-512x512.png`, propósito `maskable`;
- `apple-touch-icon.png`;
- badge monocromático apropiado para notificaciones.

Los iconos deben tener padding seguro para máscaras circulares y no depender del color de una paleta específica. No reutilizar sin revisar los SVG genéricos de Next.js presentes en `public/`.

Actualizar metadatos de `app/layout.tsx` solamente en lo necesario. Mantener el script actual que evita el destello incorrecto del tema y las paletas.

---

## 10. Service worker

Crear `public/sw.js` o la ubicación recomendada por la documentación local de Next.js 16.3.5. Debe controlar el scope `/`.

### 10.1 Evento `push`

- Usar `event.waitUntil(...)`.
- Validar que exista `event.data`.
- Parsear JSON dentro de `try/catch`.
- Construir una notificación con valores predeterminados seguros.
- Usar `tag` estable por tarea y revisión para evitar acumulaciones visuales accidentales.
- Incluir en `data` solamente `url`, `taskId` y `revision`.
- No ejecutar código que dependa de memoria conservada entre eventos.

Payload esperado:

```json
{
  "title": "Mi Ministerio",
  "body": "Tenés una asignación próxima.",
  "icon": "/icons/icon-192x192.png",
  "badge": "/icons/notification-badge.png",
  "tag": "task-{taskId}-r{revision}",
  "url": "/tareas?task={taskId}",
  "taskId": "...",
  "revision": 1
}
```

No confiar ciegamente en una URL recibida. Permitir únicamente rutas internas que comiencen con `/` y rechazar esquemas o hosts externos.

### 10.2 Evento `notificationclick`

- Cerrar la notificación.
- Buscar una ventana existente del mismo origen mediante `clients.matchAll({ type: "window", includeUncontrolled: true })`.
- Si existe, enfocarla y navegar a la ruta interna.
- Si no existe, usar `clients.openWindow()`.
- Envolver el flujo con `event.waitUntil(...)`.

### 10.3 Actualizaciones

- No llamar `skipWaiting()` de manera incondicional durante `install`.
- Detectar en el cliente si existe un worker nuevo esperando.
- Mostrar una notificación interna discreta: `Hay una actualización disponible` con botón `Actualizar`.
- Al aceptar, enviar `{ type: "SKIP_WAITING" }` al worker en espera.
- Recargar una sola vez cuando ocurra `controllerchange`.

### 10.4 Cabeceras

Configurar para el archivo del service worker:

```text
Content-Type: application/javascript; charset=utf-8
Cache-Control: no-cache, no-store, must-revalidate
Content-Security-Policy: default-src 'self'; script-src 'self'
```

No sobrescribir cabeceras existentes sin revisarlas.

---

## 11. Registro del service worker y detección de plataforma

Crear un componente cliente pequeño, por ejemplo `app/components/pwa-registration.tsx`, montado una sola vez desde el layout raíz o desde el árbol autenticado.

Responsabilidades:

- comprobar `'serviceWorker' in navigator`;
- registrar el worker con `scope: "/"` y `updateViaCache: "none"`;
- detectar actualizaciones;
- no solicitar permisos;
- no mostrar errores técnicos al usuario final;
- registrar errores sanitizados solamente en desarrollo;
- exponer el estado necesario al componente de Configuración mediante utilidades o un hook, sin crear un segundo registro.

Detección de capacidades mediante feature detection:

```text
serviceWorker in navigator
PushManager in window
Notification in window
```

No tomar decisiones de soporte basadas únicamente en el user agent. El user agent puede utilizarse solo para mostrar instrucciones específicas de instalación en iOS.

---

## 12. Experiencia de usuario en Configuración

Agregar una tarjeta `Notificaciones` en `app/configuracion/page.tsx`, respetando el diseño actual y extrayendo la lógica a un componente separado, por ejemplo `app/configuracion/notification-settings.tsx`.

### 12.1 Estados visibles

1. **Cargando:** `Comprobando este dispositivo…`
2. **No compatible:** explicar que puede seguir usando el calendario del teléfono.
3. **iPhone/iPad no instalado:** mostrar pasos breves para Compartir → Añadir a pantalla de inicio; no mostrar un botón falso de instalación.
4. **Compatible, permiso no solicitado:** botón `Activar notificaciones`.
5. **Permiso concedido, sin suscripción:** botón `Activar en este dispositivo`.
6. **Activo:** indicador `Notificaciones activas en este dispositivo`, botón `Enviar prueba` y acción secundaria `Desactivar en este dispositivo`.
7. **Permiso denegado:** explicar que debe habilitarse desde la configuración del navegador o del sistema. No volver a invocar automáticamente el prompt.
8. **Error recuperable:** mensaje claro y botón `Reintentar`.

### 12.2 Instalación

- En navegadores Chromium puede capturarse `beforeinstallprompt` y ofrecer `Instalar Mi Ministerio` solamente cuando el evento esté disponible.
- En Safari iOS mostrar instrucciones manuales.
- No afirmar que está instalada basándose solo en la existencia del service worker. Usar `matchMedia('(display-mode: standalone)')` y, donde exista, `navigator.standalone`.

### 12.3 Permiso

`Notification.requestPermission()` debe ejecutarse directamente como consecuencia del botón `Activar notificaciones`. Antes del prompt nativo, mostrar una explicación corta del beneficio.

### 12.4 Estado por dispositivo

La tarjeta representa el dispositivo/navegador actual, no un interruptor global de toda la cuenta. El texto debe decir expresamente `en este dispositivo`.

---

## 13. API de suscripciones

Preferir Route Handlers porque el proyecto ya utiliza `/api/*` y `requireUser()`.

### 13.1 `GET /api/push/status`

Respuesta mínima:

```json
{
  "configured": true,
  "serverSupported": true
}
```

No devolver las claves privadas ni listar suscripciones completas. El estado local de la suscripción se obtiene desde `registration.pushManager.getSubscription()`.

### 13.2 `POST /api/push/subscribe`

Cuerpo validado con Zod:

```json
{
  "subscription": {
    "endpoint": "https://...",
    "expirationTime": null,
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "timeZone": "America/Argentina/Buenos_Aires",
  "deviceLabel": "Chrome en Android"
}
```

Reglas:

- autenticación obligatoria;
- endpoint HTTPS;
- límites de longitud explícitos;
- `p256dh` y `auth` obligatorios;
- zona IANA validada;
- `upsert` por endpoint;
- actualizar `lastSeenAt`, `active`, zona y user agent;
- nunca aceptar rol ni `userId` del cliente;
- reconciliar recordatorios futuros después de confirmar la suscripción.

### 13.3 `DELETE /api/push/subscribe`

- autenticación obligatoria;
- identificar la suscripción por el endpoint exacto del dispositivo actual;
- comprobar pertenencia al usuario antes de desactivarla o eliminarla;
- ejecutar primero `subscription.unsubscribe()` en el navegador y después informar al servidor;
- si una parte falla, mantener un estado recuperable e idempotente.

Se recomienda desactivación lógica (`active=false`) para conservar diagnósticos, con limpieza física posterior de registros antiguos sin entregas necesarias.

### 13.4 `POST /api/push/test`

- autenticación obligatoria;
- enviar solo al endpoint presentado por el dispositivo actual y perteneciente al usuario;
- aplicar límite de frecuencia, por ejemplo una prueba cada 30 segundos por usuario/dispositivo;
- usar el mismo sender de producción;
- no aceptar título, cuerpo o URL arbitrarios desde el cliente.

---

## 14. Programación del trabajo desde las asignaciones

Crear un servicio de dominio, por ejemplo:

```text
lib/notifications/schedule-task-reminder.ts
lib/notifications/time-zone.ts
```

No duplicar el cálculo entre POST y PATCH.

### 14.1 Cálculo del instante

Para modo relativo:

1. interpretar `date` y `timeMinute` en `reminderTimeZone` usando `date-fns-tz`;
2. convertir ese instante a UTC;
3. restar `reminderMinutesBefore`;
4. validar que el resultado sea futuro.

Para modo personalizado:

1. parsear `reminderAt` como ISO;
2. validar que represente un instante válido y futuro;
3. conservar `reminderTimeZone` para visualización y auditoría.

No concatenar fecha/hora y agregar `Z` manualmente. Eso interpretaría incorrectamente la hora local como UTC.

### 14.2 Atomicidad

Crear/actualizar la asignación y crear/reprogramar/cancelar su trabajo dentro de una única transacción corta de base de datos.

No enviar Web Push dentro de esa transacción.

### 14.3 Reconciliación

Implementar una función idempotente que reciba `userId` y revise asignaciones pendientes futuras con recordatorio activo. Se utilizará:

- al activar notificaciones por primera vez;
- opcionalmente después de restaurar un backup;
- como herramienta de reparación controlada.

---

## 15. Despachador de notificaciones

Crear un Route Handler interno:

```text
POST /api/internal/notifications/process
```

Será invocado cada minuto por cron en el VPS. No depender de `setInterval()` dentro del proceso Next.js: los reinicios, múltiples instancias o suspensiones lo vuelven poco confiable.

### 15.1 Autenticación interna

- Exigir `Authorization: Bearer <CRON_SECRET>`.
- Comparar el secreto de forma segura.
- Rechazar si falta la variable o la cabecera.
- No permitir sesión de usuario como sustituto.
- Responder con un resumen sin endpoint, claves ni información personal.

### 15.2 Reclamación concurrente

Reclamar lotes pequeños, por ejemplo 25 trabajos, mediante una transacción corta y `FOR UPDATE SKIP LOCKED` o una operación atómica equivalente.

Condiciones:

- estado `PENDING` o `FAILED` recuperable;
- `nextAttemptAt <= now()`;
- `scheduledFor` dentro del margen permitido;
- trabajo no bloqueado o lock vencido;
- asignación todavía `PENDING` y con recordatorio activo.

Dentro de la transacción:

- cambiar a `PROCESSING`;
- establecer `lockedAt`;
- incrementar intentos cuando corresponda;
- devolver los trabajos reclamados.

Terminar la transacción antes de contactar los servicios push.

### 15.3 Entregas

Por cada trabajo:

1. cargar suscripciones activas del usuario;
2. crear mediante `upsert` una entrega por suscripción y revisión;
3. omitir entregas ya `SENT`;
4. enviar con `web-push` fuera de transacciones largas;
5. actualizar cada entrega individualmente;
6. calcular el estado agregado del trabajo.

### 15.4 Respuestas del proveedor push

- Éxito: marcar entrega `SENT` y guardar `sentAt`.
- HTTP 404 o 410: marcar entrega `GONE` y `PushSubscription.active=false`.
- HTTP 429 o 5xx: marcar `FAILED` recuperable y aplicar backoff.
- Otros 4xx permanentes: registrar código sanitizado y no reintentar indefinidamente.
- Nunca escribir el endpoint completo ni las claves en logs.

Backoff sugerido: 1, 5 y 15 minutos, sin superar el margen máximo de retraso. Máximo 5 intentos configurables.

### 15.5 Recuperación de locks

Un trabajo `PROCESSING` con `lockedAt` anterior a 10 minutos debe poder recuperarse. La recuperación debe ser atómica y auditable.

### 15.6 Estado final

- `SENT`: todas las entregas aplicables se enviaron o no quedaba ninguna suscripción activa después de depurar endpoints caducados, según una regla documentada.
- `PARTIAL`: al menos una entrega fue exitosa y otra terminó con fallo permanente.
- `FAILED`: ninguna entrega se completó y todavía puede diagnosticarse/reintentarse.
- `EXPIRED`: se superó el retraso máximo.
- `CANCELLED`: la asignación dejó de cumplir las condiciones.
- `SKIPPED`: no existía ninguna suscripción activa aplicable; no equivale a una entrega exitosa.

Si no hay suscripciones activas, no reintentar indefinidamente. Marcar el trabajo `SKIPPED` con una razón interna sanitizada.

---

## 16. Sender y configuración VAPID

Crear un módulo exclusivamente de servidor, por ejemplo `lib/notifications/web-push.ts`.

Responsabilidades:

- importar `web-push` solamente en código servidor;
- validar al iniciar el uso:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`;
  - `VAPID_PRIVATE_KEY`;
  - `VAPID_SUBJECT`;
- ejecutar `webpush.setVapidDetails(...)` una sola vez por proceso;
- construir la suscripción en el formato esperado por la biblioteca;
- serializar un payload pequeño;
- clasificar errores por código HTTP sin filtrar secretos.

Variables:

```dotenv
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:correo-operativo@example.com
CRON_SECRET=
NOTIFICATION_MAX_LATENESS_MINUTES=30
NOTIFICATION_BATCH_SIZE=25
NOTIFICATION_MAX_ATTEMPTS=5
```

Solo la clave pública puede usar el prefijo `NEXT_PUBLIC_`. La clave privada y `CRON_SECRET` nunca deben aparecer en código cliente, HTML, respuestas API, repositorio ni logs.

Agregar nombres y explicación a `.env.example`, sin valores reales.

---

## 17. Enlace profundo a la asignación

La URL de la notificación será `/tareas?task=<id>`.

Actualizar `app/tareas/client.tsx` para:

- leer el query param;
- cargar la asignación únicamente a través de una API que verifique el `userId` de la sesión;
- abrir el modal de edición si existe y pertenece al usuario;
- mostrar un mensaje discreto si fue eliminada o ya no existe;
- limpiar o reemplazar el parámetro cuando se cierre el modal, sin recargar toda la página;
- no permitir enumeración de asignaciones ajenas.

Si la sesión expiró, NextAuth debe dirigir al login y, después de autenticar, conservar o recuperar la URL de retorno si el flujo actual lo permite. No debilitar la autenticación para facilitar el enlace.

---

## 18. Cambios esperados por archivo

Lista orientativa; la IA debe confirmar las rutas reales:

```text
package.json                                      dependencias y scripts necesarios
pnpm-lock.yaml                                   lock actualizado por pnpm
.env.example                                     variables sin secretos
next.config.ts                                   cabeceras del service worker
prisma/schema.prisma                             modelos, enums, relaciones e índices
prisma/migrations/<timestamp>_web_push/...       migración nueva
app/manifest.ts                                  manifest PWA
app/layout.tsx                                   metadatos y registro global mínimo
app/components/pwa-registration.tsx              registro y actualización del SW
app/configuracion/notification-settings.tsx      UI por dispositivo
app/configuracion/page.tsx                       insertar la tarjeta
app/tareas/client.tsx                            validaciones UX y deep link
app/api/tasks/route.ts                           programación transaccional
app/api/tasks/[id]/route.ts                      reprogramación/cancelación
app/api/push/status/route.ts                     estado servidor
app/api/push/subscribe/route.ts                  alta/upsert
app/api/push/unsubscribe/route.ts                baja idempotente
app/api/push/test/route.ts                       prueba limitada
app/api/internal/notifications/process/route.ts  worker invocable por cron
lib/notifications/config.ts                      validación de entorno
lib/notifications/time-zone.ts                   zona y cálculo UTC
lib/notifications/scheduler.ts                   trabajos de recordatorio
lib/notifications/sender.ts                      web-push y clasificación de errores
lib/notifications/worker.ts                      claim, entrega y estados
lib/validations/push.ts                          esquemas Zod
public/sw.js                                     push/click/update, sin fetch cache
public/icons/*                                   iconos y badge
```

No es obligatorio usar exactamente esta fragmentación si la alternativa mantiene responsabilidades claras y es testeable.

---

## 19. Seguridad y aislamiento multiusuario

Requisitos no negociables:

- Toda API de usuario usa `requireUser()`.
- Toda consulta de tarea incluye `userId`.
- Toda baja o prueba de suscripción verifica pertenencia.
- El endpoint interno usa secreto independiente, no cookies.
- El cliente nunca decide a qué usuario enviar.
- Validar tamaño y formato de endpoints y claves antes de guardar.
- No permitir URLs externas en el payload de clic.
- No incluir secretos Web Push en backups.
- No incluir endpoints ni claves en mensajes de error.
- Limitar frecuencia del envío de prueba.
- Limitar tamaño de lote y tiempo de ejecución del worker.
- Aplicar cabeceras seguras al service worker.
- Mantener la clave privada solo en variables de entorno del servidor.

Revisar también que el service worker no intercepte el login ni prolongue visualmente una sesión cerrada.

---

## 20. Backup y restauración

El backup debe conservar la configuración funcional de las asignaciones:

- `reminderEnabled`;
- `reminderMinutesBefore`;
- `reminderAt`;
- `reminderTimeZone`, si se incorpora.

Debe excluir:

- `PushSubscription`;
- `TaskNotificationJob`;
- `PushNotificationDelivery`;
- claves VAPID;
- `CRON_SECRET`.

Después de restaurar un backup, reconciliar recordatorios futuros únicamente si el usuario tiene al menos una suscripción activa y existe información temporal suficiente. No enviar recordatorios pasados durante la restauración.

---

## 21. Despliegue previsto en VPS

La implementación debe quedar preparada aunque el VPS definitivo todavía no esté decidido.

Requisitos:

- dominio con HTTPS válido;
- proceso Next.js/Node persistente;
- PostgreSQL y migraciones aplicadas antes de iniciar la nueva versión;
- variables VAPID y cron configuradas;
- cron o timer que haga un `POST` al endpoint interno cada minuto;
- timeout razonable del llamado;
- logs estructurados y sanitizados;
- una sola clave VAPID estable entre despliegues.

No regenerar claves VAPID en cada despliegue: cambiar la clave pública invalida las suscripciones existentes y obliga a suscribirse nuevamente.

La documentación de despliegue debe incluir un ejemplo de cron, pero no guardar el secreto literalmente en el crontab si el entorno permite leerlo desde un archivo protegido o variable de entorno.

---

## 22. Estrategia de pruebas

### 22.1 Unitarias

Cubrir al menos:

- conversión de `date + timeMinute + timeZone` a UTC;
- resta de anticipación;
- cambios de día y de mes;
- zonas con y sin horario de verano;
- fecha/hora inexistente o ambigua por DST;
- recordatorio personalizado válido e inválido;
- relativo sin hora rechazado;
- zona IANA inválida rechazada;
- cálculo de caducidad;
- clasificación 404/410, 429, 4xx y 5xx de Web Push;
- URL interna segura para `notificationclick`.

Congelar el reloj en pruebas; no depender de la hora real.

### 22.2 Integración/API

Cubrir:

- usuario no autenticado recibe 401/flujo equivalente del proyecto;
- usuario A no puede consultar, eliminar ni probar la suscripción de B;
- suscribirse dos veces al mismo endpoint hace `upsert`, no duplica;
- desuscribirse dos veces es idempotente;
- crear una asignación con recordatorio crea un trabajo;
- editarla incrementa revisión y reprograma;
- completarla o desactivar recordatorio cancela;
- eliminarla borra en cascada;
- dos ejecuciones concurrentes del worker no duplican entregas;
- una entrega ya `SENT` no vuelve a enviarse;
- endpoint 410 desactiva la suscripción;
- cron sin secreto o con secreto incorrecto es rechazado;
- una falla de un dispositivo no impide procesar los demás.

### 22.3 Service worker

Probar:

- payload válido;
- payload vacío o JSON inválido sin romper el worker;
- notificación mostrada con tag esperado;
- clic enfoca una ventana existente;
- clic abre una nueva ventana si no hay cliente;
- URL externa o maliciosa se reemplaza por `/tareas`;
- actualización en espera se aplica solo tras confirmación del usuario.

### 22.4 Manual por plataforma

Matriz mínima:

| Plataforma | Navegador | Prueba |
|---|---|---|
| Windows | Chrome o Edge | instalar, activar, prueba, recibir con pestaña cerrada |
| Android | Chrome | instalar, activar, recibir con PWA cerrada, tocar deep link |
| iPhone/iPad 16.4+ | PWA en pantalla de inicio | activar desde PWA, recibir bloqueado, tocar deep link |
| Navegador sin soporte o permiso denegado | disponible | fallback claro y aplicación funcional |

Para desarrollo local de push utilizar HTTPS, por ejemplo la opción `--experimental-https` soportada por la versión instalada de Next.js. `localhost` sin HTTPS no representa todas las condiciones de un teléfono real.

### 22.5 Regresión

Verificar que siguen funcionando:

- login y registro;
- cambio de tema y las seis paletas;
- creación, edición, completado y eliminación de asignaciones;
- exportación ICS;
- backup y restauración;
- navegación desktop y mobile;
- ausencia de errores de hidratación;
- aislamiento de datos entre usuarios.

---

## 23. Validaciones técnicas obligatorias

Ejecutar y reportar resultados reales:

```text
pnpm exec prisma validate
pnpm exec prisma migrate status
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Ejecutar además la suite de pruebas incorporada. Si el proyecto todavía no tiene runner, agregar uno apropiado y documentar por qué fue elegido.

También:

- ejecutar `git diff --check`;
- revisar el diff completo;
- comprobar que no se agregó ningún secreto;
- revisar el manifest en DevTools → Application;
- revisar registro, scope y actualización del service worker;
- comprobar que Cache Storage permanezca vacío para esta fase;
- comprobar que una respuesta API autenticada no se sirve desde service worker.

Un build correcto no sustituye la prueba real de recepción de Web Push.

---

## 24. Observabilidad mínima

Registrar de forma estructurada:

- cantidad de trabajos reclamados;
- entregas exitosas;
- entregas fallidas por categoría de código;
- suscripciones desactivadas por 404/410;
- trabajos expirados;
- duración total del lote.

No registrar:

- endpoint completo;
- `p256dh`;
- `auth`;
- clave VAPID privada;
- secreto del cron;
- notas o información de personas interesadas.

Para correlación usar IDs internos del trabajo y entrega. Los errores mostrados al usuario deben ser comprensibles; los detalles técnicos quedan en logs sanitizados.

---

## 25. Orden recomendado de implementación

### Fase 1: fundamentos PWA

- manifest;
- iconos;
- metadatos;
- service worker push-only;
- registro y actualización;
- cabeceras.

**Criterio de salida:** PWA instalable y worker visible en DevTools sin interceptar red ni crear cachés.

### Fase 2: persistencia y suscripción

- modelos Prisma y migración;
- variables VAPID;
- APIs de alta/baja/estado/prueba;
- tarjeta de Configuración;
- soporte de instalación iOS/Chromium.

**Criterio de salida:** dos usuarios y dos dispositivos mantienen suscripciones aisladas; prueba push real recibida.

### Fase 3: programación de asignaciones

- zona horaria;
- reglas de formulario;
- cálculo UTC;
- transacciones de crear/editar/completar/eliminar;
- reconciliación;
- deep link.

**Criterio de salida:** cada cambio funcional deja exactamente el trabajo esperado en base de datos.

### Fase 4: worker y confiabilidad

- endpoint interno;
- claim concurrente;
- entregas idempotentes;
- reintentos, caducidad y limpieza 404/410;
- observabilidad.

**Criterio de salida:** ejecuciones concurrentes y repetidas no duplican notificaciones.

### Fase 5: QA y documentación

- pruebas automáticas;
- matriz manual;
- validaciones de build/lint/types/Prisma;
- documentación VPS;
- capturas/evidencias.

---

## 26. Criterios de aceptación finales

La funcionalidad se considera terminada únicamente si se cumplen todos:

- [ ] La PWA puede instalarse con nombre e iconos correctos.
- [ ] La aplicación sigue siendo online-first y el service worker no cachea datos autenticados.
- [ ] El permiso se solicita solo mediante acción explícita.
- [ ] iOS recibe instrucciones correctas para añadir a inicio antes de habilitar push.
- [ ] Una cuenta puede tener varias suscripciones.
- [ ] Las suscripciones de distintos usuarios están aisladas.
- [ ] Activar/desactivar en un dispositivo no altera silenciosamente los demás.
- [ ] La prueba push llega al dispositivo actual.
- [ ] Un recordatorio relativo sin hora no puede guardarse.
- [ ] Los cálculos usan zona IANA y persisten el instante UTC.
- [ ] Crear/editar una asignación programa o reprograma correctamente.
- [ ] Completar, desactivar o eliminar cancela el envío pendiente.
- [ ] El worker funciona desde un endpoint protegido por `CRON_SECRET`.
- [ ] Dos ejecuciones concurrentes no generan duplicados.
- [ ] 404/410 desactiva la suscripción inválida.
- [ ] Los reintentos tienen límite y los avisos viejos caducan.
- [ ] Tocar la notificación abre la asignación correcta.
- [ ] La exportación ICS sigue funcionando.
- [ ] Los backups no contienen secretos ni suscripciones.
- [ ] Temas, paletas y diseño responsive no presentan regresiones.
- [ ] TypeScript, lint, build, Prisma y pruebas pasan.
- [ ] Existe evidencia de una recepción real con la PWA cerrada.

---

## 27. Entrega que debe dejar la IA implementadora

La entrega debe contener:

1. Resumen de arquitectura realmente implementada.
2. Lista exacta de archivos creados y modificados.
3. Migración Prisma y prueba de que fue aplicada en desarrollo.
4. Variables de entorno nuevas, sin revelar valores.
5. Comandos ejecutados y sus resultados.
6. Pruebas automáticas agregadas y resultado.
7. Matriz manual con plataforma, navegador y resultado.
8. Instrucciones de generación y conservación de claves VAPID.
9. Instrucciones de configuración del cron en VPS.
10. Limitaciones o diferencias justificadas respecto de este plan.
11. Evidencia de que no se cachean páginas/API autenticadas.
12. Evidencia de idempotencia y aislamiento multiusuario.

No aceptar como evidencia únicamente capturas de código, un build exitoso o una notificación disparada manualmente desde DevTools.

---

## 28. Referencias oficiales

- Next.js, PWA y Web Push: <https://nextjs.org/docs/app/guides/progressive-web-apps>
- Next.js, manifest: <https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest>
- MDN, Push API: <https://developer.mozilla.org/en-US/docs/Web/API/Push_API>
- MDN, Notifications API: <https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API>
- WebKit, Web Push en iOS/iPadOS: <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>

La implementación debe priorizar la documentación local de Next.js instalada en el repositorio cuando difiera de ejemplos de otras versiones.
