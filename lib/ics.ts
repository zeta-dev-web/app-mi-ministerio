/** Generador ICS mínimo (RFC 5545) para "Añadir al calendario del teléfono". */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toICSDate(date: Date, timeMinute: number | null): string {
  if (timeMinute == null) {
    // Evento de día completo (fecha local, sin hora)
    const y = date.getUTCFullYear();
    const m = pad(date.getUTCMonth() + 1);
    const d = pad(date.getUTCDate());
    return `${y}${m}${d}`;
  }
  const dt = new Date(date);
  dt.setUTCHours(Math.floor(timeMinute / 60), timeMinute % 60, 0, 0);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00`;
}

function toICSDateTime(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildTaskICS(task: {
  id: string;
  type: string;
  topic: string | null;
  date: Date;
  timeMinute: number | null;
  notes: string | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number | null;
  reminderAt: Date | null;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mi Ministerio//Tareas//ES",
    "BEGIN:VEVENT",
    `UID:${task.id}@mi-ministerio`,
    `SUMMARY:${escapeICS(task.topic ? `${task.type}: ${task.topic}` : task.type)}`,
  ];
  if (task.timeMinute == null) {
    lines.push(`DTSTART;VALUE=DATE:${toICSDate(task.date, null)}`);
  } else {
    lines.push(`DTSTART:${toICSDate(task.date, task.timeMinute)}`);
    const end = task.timeMinute + 60;
    lines.push(`DTEND:${toICSDate(task.date, end > 1439 ? 1439 : end)}`);
  }
  if (task.notes) lines.push(`DESCRIPTION:${escapeICS(task.notes)}`);
  if (task.reminderEnabled && (task.reminderMinutesBefore != null || task.reminderAt)) {
    const trigger = task.reminderAt
      ? `TRIGGER;VALUE=DATE-TIME:${toICSDateTime(task.reminderAt)}`
      : `TRIGGER:-PT${task.reminderMinutesBefore}M`;
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", trigger, "END:VALARM");
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
