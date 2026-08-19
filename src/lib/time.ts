/**
 * CINERGIA opera en Lima (UTC-5, sin horario de verano). Un input
 * `datetime-local` entrega "2026-09-01T10:00" sin offset — pasarlo tal
 * cual a Postgres lo interpreta como UTC literal, corriendo cada hora 5
 * horas de más. Se fija el offset acá, no en el navegador, porque el
 * servidor no puede asumir la zona horaria del dispositivo de quien
 * carga la página. Ver D28 en docs/decisiones-tecnicas.md.
 */
export function toLimaInstant(datetimeLocal: string): string {
  return `${datetimeLocal}:00-05:00`;
}

/** Zona horaria explícita para Intl.DateTimeFormat — ver toLimaInstant(). */
export const LIMA_TZ = 'America/Lima';
