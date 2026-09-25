/**
 * Informe mensual de servicio.
 * - Roles con cuota (precursores, etc.): informan horas + cursos bíblicos
 *   (personas distintas a las que se dirige el curso, no cantidad de visitas).
 * - Publicador: no informa horas; solo si predicó en el mes.
 */

export type ReportData = {
  monthLabel: string;
  name: string;
  serviceRole: string | null;
  congregation: string | null;
  isPublisher: boolean;
  totalMinutes: number;
  goalHours: number | null;
  studyPersonCount: number;
  carryMinutes?: boolean;
  prevLeftover?: number;
  reportedHours?: number;
};

export function formatHours(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Minutos sobrantes del mes (resto no reportable en horas completas). */
export function monthLeftover(totalMinutes: number): number {
  return totalMinutes % 60;
}

/**
 * Horas completas a reportar.
 * - leftover: minutos sobrantes del mes actual (totalMinutes % 60).
 * - base: horas completas del mes + arrastre del mes anterior si carry.
 * - carry=true: informa horas completas hacia abajo, sumando el sobrante anterior.
 * - carry=false: redondea hacia arriba para completar la hora del mes actual.
 */
export function reportedHours(
  totalMinutes: number,
  prevLeftover: number,
  carry: boolean
): { reportedHours: number; leftover: number } {
  const leftover = totalMinutes % 60;
  const base = totalMinutes - leftover + (carry ? prevLeftover : 0);
  if (totalMinutes <= 0 || (carry && base <= 0)) return { reportedHours: 0, leftover };
  const reported = carry ? Math.floor(base / 60) : Math.ceil(totalMinutes / 60);
  return { reportedHours: reported, leftover };
}

export function buildReportText(r: ReportData, preached: boolean): string {
  const who = `${r.name}${r.congregation ? ` · Cong. ${r.congregation}` : ""}`;
  if (r.isPublisher) {
    return [
      `INFORME DE SERVICIO – ${r.monthLabel}`,
      who,
      preached ? "Informa que predicó durante este mes." : "No predicó durante este mes.",
    ].join("\n");
  }
  const hours =
    r.reportedHours ?? reportedHours(r.totalMinutes, r.prevLeftover ?? 0, r.carryMinutes ?? false).reportedHours;
  const lines = [
    `INFORME DE SERVICIO – ${r.monthLabel}`,
    who,
    "",
    `Horas: ${hours} h${r.goalHours != null ? ` (meta: ${r.goalHours} h)` : ""}`,
    `Cursos bíblicos: ${r.studyPersonCount}`,
  ];
  if ((r.carryMinutes ?? false) && (r.prevLeftover ?? 0) > 0 && hours > 0) {
    lines.push(`Incluye ${r.prevLeftover} min del mes anterior.`);
  }
  return lines.join("\n");
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
