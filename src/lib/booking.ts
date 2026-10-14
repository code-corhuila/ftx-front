import type { AvailabilitySlot, IsoDate, IsoTime, Money, Reservation } from "../api/types";
import { addHours, hoursBetween } from "./format";
import { readJson, removeKey, writeJson } from "./storage";
import type { ContactInput } from "./validation";

/**
 * Estado del flujo /booking/*. Vive en sessionStorage para sobrevivir a la redirección
 * de ida y vuelta a Wompi, y muere al cerrar la pestaña.
 */
export interface BookingState {
  courtId: string;
  courtName: string;
  date: IsoDate;
  startTime: IsoTime;
  /** Precio de referencia; el backend recalcula el monto. */
  hourlyPrice: Money;
  /** Franjas consultadas, para saber cuántas horas seguidas están libres. */
  slots: AvailabilitySlot[];
  hours: number;
  customer: ContactInput;
  /** Idempotency-Key de POST /reservations para este intento. */
  reservationKey?: string;
  reservation?: Reservation;
  /** Idempotency-Key de POST /payments/checkouts para este intento. */
  checkoutKey?: string;
}

const KEY = "ftx.booking";

export const EMPTY_CONTACT: ContactInput = { customerName: "", customerPhone: "", customerEmail: "" };

export const getBooking = (): BookingState | null => readJson<BookingState>("session", KEY);

export function saveBooking(state: BookingState): void {
  writeJson("session", KEY, state);
}

export function updateBooking(patch: Partial<BookingState>): BookingState | null {
  const current = getBooking();
  if (!current) return null;
  const next = { ...current, ...patch };
  saveBooking(next);
  return next;
}

export const clearBooking = (): void => removeKey("session", KEY);

/** ¿Están libres las `hours` franjas consecutivas que empiezan en `start`? */
export function canBook(slots: AvailabilitySlot[], start: IsoTime, hours: number): boolean {
  for (let i = 0; i < hours; i++) {
    const slot = slots.find((s) => s.startTime === addHours(start, i));
    if (!slot || !slot.available) return false;
  }
  return true;
}

export function maxConsecutiveHours(slots: AvailabilitySlot[], start: IsoTime, limit: number): number {
  let hours = 0;
  while (hours < limit && canBook(slots, start, hours + 1)) hours++;
  return hours;
}

/** Prepara el flujo de pago para una reserva PENDING existente (p. ej. desde la consulta por código). */
export function bookingFromReservation(r: Reservation, courtName: string): BookingState {
  const hours = Math.max(1, hoursBetween(r.startTime, r.endTime));
  return {
    courtId: r.courtId,
    courtName,
    date: r.reservationDate,
    startTime: r.startTime,
    hourlyPrice: { amount: Math.round(r.amount.amount / hours), currency: "COP" },
    slots: [],
    hours,
    customer: { customerName: r.customerName, customerPhone: r.customerPhone, customerEmail: r.customerEmail },
    reservation: r,
  };
}
