import type {
  CancelledBy,
  CourtStatus,
  DayOfWeek,
  IsoDate,
  IsoTime,
  Money,
  PaymentStatus,
  ReservationStatus,
} from "../api/types";

// ─── Dinero ──────────────────────────────────────────────────────────────────

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export const formatMoney = (value: Money | number): string =>
  cop.format(typeof value === "number" ? value : value.amount);

// ─── Fechas (siempre en hora local: `toISOString` daría el día UTC) ──────────

export const pad2 = (n: number): string => String(n).padStart(2, "0");

export function toIsoDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const todayIso = (): IsoDate => toIsoDate(new Date());

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function parseIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseIsoDate(value);
  return toIsoDate(d) === value;
}

export const formatDate = (iso: IsoDate): string =>
  parseIsoDate(iso).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const formatShortDate = (iso: IsoDate): string =>
  parseIsoDate(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

export const formatDateTime = (ts: string): string =>
  new Date(ts).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

// ─── Horas (la API usa `HH:mm:ss`) ───────────────────────────────────────────

export const hhmm = (t: IsoTime): string => t.slice(0, 5);

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const minutesToTime = (min: number): IsoTime => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}:00`;

export const addHours = (t: IsoTime, hours: number): IsoTime => minutesToTime(timeToMinutes(t) + hours * 60);

/** `"18:00"` (input type=time) → `"18:00:00"`. */
export const toApiTime = (value: string): IsoTime => (value.length === 5 ? `${value}:00` : value);

export const hoursBetween = (start: IsoTime, end: IsoTime): number => (timeToMinutes(end) - timeToMinutes(start)) / 60;

// ─── Días ────────────────────────────────────────────────────────────────────

const JS_DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export const dayOfWeekOf = (iso: IsoDate): DayOfWeek => JS_DAYS[parseIsoDate(iso).getDay()];

export const WEEK: DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export const DAY_LABEL: Record<DayOfWeek, string> = {
  MON: "Lunes",
  TUE: "Martes",
  WED: "Miércoles",
  THU: "Jueves",
  FRI: "Viernes",
  SAT: "Sábado",
  SUN: "Domingo",
};

// ─── Etiquetas de estado (12-ux-ui/design-system.md) ─────────────────────────

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  REJECTED: "Rechazada",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pago pendiente",
  APPROVED: "Pago aprobado",
  REJECTED: "Pago rechazado",
  REFUNDED: "Reembolsado",
};

export const COURT_STATUS_LABEL: Record<CourtStatus, string> = {
  ACTIVE: "Disponible",
  INACTIVE: "No disponible",
  UNDER_MAINTENANCE: "En mantenimiento",
};

export const CANCELLED_BY_LABEL: Record<CancelledBy, string> = {
  CUSTOMER: "Cliente",
  ADMINISTRATOR: "Administrador",
};
