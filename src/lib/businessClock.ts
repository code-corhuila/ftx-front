// Reloj del negocio. Futbolix opera en Colombia (COP, teléfonos +57, CORHUILA en Neiva), así que
// "hoy" y "ahora" se calculan en America/Bogota (UTC−5, sin horario de verano), nunca con la
// zona del computador del cliente ni con la fecha UTC.

import type { IsoDate, IsoTime } from "../api/types";

export const BUSINESS_TIME_ZONE = "America/Bogota";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface BusinessNow {
  /** Fecha del negocio, `YYYY-MM-DD`. */
  date: IsoDate;
  /** Minutos transcurridos del día en la zona del negocio (0–1439), truncados al minuto. */
  minutes: number;
}

export function businessNow(now: Date = new Date()): BusinessNow {
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(now)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export const businessToday = (now: Date = new Date()): IsoDate => businessNow(now).date;

function toMinutes(t: IsoTime): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Regla: una reserva puede empezar en el minuto actual del negocio o después.
 * A las 18:00 se rechaza 17:59 (y cualquier hora anterior de ese día) y se acepta 18:00.
 * El sistema no define tiempo de anticipación, así que no se añade ningún margen.
 */
export function isPastStart(date: IsoDate, startTime: IsoTime, now: Date = new Date()): boolean {
  const current = businessNow(now);
  if (date !== current.date) return date < current.date;
  return toMinutes(startTime) < current.minutes;
}
