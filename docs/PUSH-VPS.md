# Despliegue de Web Push en VPS (Mi Ministerio — FASE 5)

> Sin secretos en este archivo: solo nombres de variables y procedimientos.

## 1. Variables de entorno necesarias

| Variable | Alcance | Descripción |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | pública (cliente) | Clave pública VAPID. La única con prefijo `NEXT_PUBLIC_`. |
| `VAPID_PRIVATE_KEY` | solo servidor | Clave privada VAPID. Nunca en cliente, respuestas API, logs ni repo. |
| `VAPID_SUBJECT` | servidor | Remitente VAPID (`mailto:tu-correo@ejemplo.com`). |
| `CRON_SECRET` | solo servidor | Secreto del cron interno (`POST /api/internal/notifications/process`). 32 bytes en hex. |
| `NOTIFICATION_MAX_LATENESS_MINUTES` | servidor | Atraso máximo antes de marcar `EXPIRED` (defecto `30`). |
| `NOTIFICATION_BATCH_SIZE` | servidor | Tamaño de lote del despachador (defecto `25`). |
| `NOTIFICATION_MAX_ATTEMPTS` | servidor | Máximo de intentos por trabajo (defecto `5`). |
| `DATABASE_URL` | servidor | PostgreSQL (ver `.env.example`). |

Ver `.env.example` para la plantilla completa.

## 2. Generación y conservación de claves VAPID

Generar **una sola vez** (en cualquier máquina con el proyecto instalado):

```bash
pnpm exec web-push generate-vapid-keys --json
```

- Guardar la clave pública en `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y la privada en
  `VAPID_PRIVATE_KEY`, tanto en dev como en el VPS.
- **No regenerar en cada despliegue**: cambiar la clave pública invalida todas
  las suscripciones existentes y obliga a cada dispositivo a suscribirse de nuevo
  (§21 del plan).
- Rotación (solo si la privada se comprometió): generar un par nuevo, desplegar
  con ambas variables actualizadas y pedir a los usuarios que reactiven
  notificaciones “en este dispositivo” desde Configuración.

## 3. Cron cada minuto (ejemplo)

El despachador es `POST /api/internal/notifications/process`, protegido por
`Authorization: Bearer <CRON_SECRET>` con comparación timing-safe. Ejemplo con
`curl`, timeout de 25 s y secreto leído desde un archivo protegido (nunca el
secreto literal en el crontab):

```bash
* * * * * /usr/bin/curl --fail --silent --show-error --max-time 25 -X POST "https://TU-DOMINIO/api/internal/notifications/process" -H "Authorization: Bearer $(cat /etc/mi-ministerio/cron-secret)" >> /var/log/mi-ministerio/cron.log 2>&1
```

- `/etc/mi-ministerio/cron-secret` debe tener permisos `600` y contener solo el secreto.
- Verificar con `?dryRun=1` primero: reclama y reporta sin enviar ni escribir entregas.
- La respuesta es un resumen sin endpoints, claves ni datos personales
  (`claimed/sent/failed/skipped/expired/cancelled/durationMs/dryRun`).

## 4. Orden de despliegue

1. **Dominio con HTTPS válido** (Web Push lo exige; también la instalación PWA).
2. **PostgreSQL + migraciones** aplicadas _antes_ de iniciar la nueva versión:
   `pnpm exec prisma migrate deploy` y `pnpm exec prisma migrate status`.
3. **Variables de entorno** del §1 configuradas en el VPS (misma VAPID de siempre).
4. **Build y arranque**: `pnpm build` + proceso Node/Next.js persistente (`next start`).
5. **Cron** del §3 activado y verificado en logs (JSON `scope: "notifications-batch"`).

## 5. Matriz manual pendiente (completar en dispositivos reales)

| Plataforma | Navegador | Prueba | Resultado |
|---|---|---|---|
| Windows | Chrome o Edge | instalar, activar, prueba, recibir con pestaña cerrada | ☐ pendiente |
| Android | Chrome | instalar, activar, recibir con PWA cerrada, tocar deep link | ☐ pendiente |
| iPhone/iPad 16.4+ | PWA en pantalla de inicio | activar desde la PWA, recibir con pantalla bloqueada, tocar deep link | ☐ pendiente |
| Sin soporte / permiso denegado | disponible | fallback claro y app funcional | ☐ pendiente |

## 6. Nota honesta: evidencia real que falta

- **Falta recepción real con la PWA cerrada en un dispositivo físico** (criterio
  §26 “existe evidencia de una recepción real con la PWA cerrada”). Los tests
  automáticos usan un sender mock y la DB dev; no sustituyen esa prueba.
- Las rutas HTTP (401 sin sesión, aislamiento vía API, `CRON_SECRET` correcto/
  incorrecto) se verificaron a nivel de lógica de dominio, no con peticiones
  HTTP contra un servidor: los Route Handlers requieren sesión NextAuth y no se
  levantan servidores en los tests. Quedan para E2E manual con la matriz del §5.
- Verificado en esta fase: `public/sw.js` no tiene `fetch` ni Cache Storage
  (online-first); el manifest se revisa en DevTools → Application al desplegar.
