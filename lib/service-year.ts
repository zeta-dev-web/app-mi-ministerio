/** Año de servicio: 1 de septiembre → 31 de agosto (como la referencia 2026-2027). */

export function serviceYearOf(date: Date): number {
  const y = date.getUTCFullYear();
  // Meses 0-11; septiembre = 8. Sept–Dic pertenecen al año que empieza; Ene–Ago al anterior.
  return date.getUTCMonth() >= 8 ? y : y - 1;
}

export function serviceYearLabel(startYear: number): string {
  return `${startYear}–${startYear + 1}`;
}

export function serviceYearRange(startYear: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(startYear, 8, 1)),
    to: new Date(Date.UTC(startYear + 1, 7, 31, 23, 59, 59)),
  };
}

const MESES = [
  "Septiembre", "Octubre", "Noviembre", "Diciembre",
  "Enero", "Febrero", "Marzo", "Abril",
  "Mayo", "Junio", "Julio", "Agosto",
];

/** Los 12 meses del año de servicio en orden. */
export function serviceYearMonths(startYear: number): { year: number; month: number; label: string }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const abs = 8 + i; // septiembre = mes 8
    const year = startYear + Math.floor(abs / 12);
    const month = abs % 12;
    return { year, month, label: `${MESES[i]} ${year}` };
  });
}
