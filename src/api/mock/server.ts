// Backend simulado: se comporta como el API Gateway + los cuatro microservicios según
// los contratos de ftx-docs/07-api. Permite usar y demostrar el frontend sin Java ni Docker.
//
// Reproduce a propósito los comportamientos que el frontend debe manejar:
//   · 409 RESERVATION_SLOT_UNAVAILABLE por solapamiento (exclusion constraint de 06-data)
//   · Idempotency-Key en POST /reservations y POST /payments/checkouts
//   · 404 genérico para códigos de reserva desconocidos o mal formados
//   · Consistencia eventual: el pago aparece ~1,5 s después de crear la reserva
//     (ReservationCreated) y la reserva se confirma ~1,2 s después del webhook
//     (PaymentApproved / PaymentRejected)
//   · Consumidores idempotentes (processed_events)
//
// Los datos se guardan en localStorage para sobrevivir a la redirección a la pasarela.

import type { ApiRawResponse, ApiRequest, HttpMethod } from "../client";
import type {
  AuthResponse,
  CancelledBy,
  Court,
  CourtStatus,
  DayOfWeek,
  ErrorDetail,
  IsoDate,
  IsoTime,
  Money,
  PaymentStatus,
  Reservation,
  ReservationStatus,
  Schedule,
} from "../types";
import { COURT_STATUS_TRANSITIONS, COURT_STATUSES } from "../../lib/courtRules";
import {
  addDays,
  dayOfWeekOf,
  isValidIsoDate,
  minutesToTime,
  timeToMinutes,
  todayIso,
  WEEK,
} from "../../lib/format";
import { readJson, removeKey, writeJson } from "../../lib/storage";
import { uuid } from "../../lib/uuid";
import { MOCK_ADMIN, MOCK_WEBHOOK_SIGNATURE } from "./constants";

// ─── Modelo ──────────────────────────────────────────────────────────────────

interface MockPayment {
  id: string;
  reservationId: string;
  reservationCode: string;
  amount: Money;
  status: PaymentStatus;
  wompiTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

type EventType = "ReservationCreated" | "ReservationCancelled" | "PaymentApproved" | "PaymentRejected";

interface MockEvent {
  eventId: string;
  type: EventType;
  reservationId: string;
  applyAt: number;
}

interface Db {
  version: number;
  courts: Court[];
  schedules: Schedule[];
  reservations: Reservation[];
  payments: MockPayment[];
  events: MockEvent[];
  processedEvents: string[];
  idempotency: Record<string, ApiRawResponse>;
  accessTokens: Record<string, number>;
  refreshTokens: string[];
}

const STORAGE_KEY = "ftx.mock.db";
const DB_VERSION = 1;
const ACCESS_TOKEN_TTL_MS = 3600 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const CODE_RE = /^[A-Z0-9]{1,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVATION_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "CANCELLED", "REJECTED"];

const nowIso = () => new Date().toISOString();

// ─── Datos iniciales ─────────────────────────────────────────────────────────

const COURT_SEED: Array<[string, string, number, number, CourtStatus]> = [
  ["7c0f4c3e-2a55-4a3b-9f0d-1b8f6e2a9c11", "Cancha 1", 10, 60000, "ACTIVE"],
  ["2b8d5f1a-6c3e-4d7b-8a9f-0e1d2c3b4a51", "Cancha 2", 10, 60000, "ACTIVE"],
  ["9e4a7b2c-1d3f-4e5a-b6c7-d8e9f0a1b2c3", "Cancha 3", 14, 90000, "ACTIVE"],
  ["5f6e7d8c-9b0a-4c1d-8e2f-3a4b5c6d7e8f", "Cancha 4", 14, 90000, "UNDER_MAINTENANCE"],
];

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 símbolos: sin sesgo de módulo

function randomCode(): string {
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  return "FTX" + Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function newCode(d: Db): string {
  let code = randomCode();
  while (d.reservations.some((r) => r.reservationCode === code)) code = randomCode();
  return code;
}

function seed(): Db {
  const created = nowIso();
  const d: Db = {
    version: DB_VERSION,
    courts: COURT_SEED.map(([id, name, capacity, price, status]) => ({
      id,
      name,
      sport: "FOOTBALL",
      capacity,
      hourlyPrice: { amount: price, currency: "COP" },
      status,
      createdAt: created,
      updatedAt: created,
    })),
    schedules: [],
    reservations: [],
    payments: [],
    events: [],
    processedEvents: [],
    idempotency: {},
    accessTokens: {},
    refreshTokens: [],
  };

  for (const [index, court] of d.courts.entries()) {
    for (const day of WEEK) {
      if (index === 2 && day === "MON") continue; // la Cancha 3 cierra los lunes
      const weekend = day === "SAT" || day === "SUN";
      d.schedules.push({
        id: uuid(),
        courtId: court.id,
        dayOfWeek: day,
        openingTime: weekend ? "07:00:00" : "08:00:00",
        closingTime: weekend ? "23:00:00" : "22:00:00",
      });
    }
  }

  const today = todayIso();
  const seedReservation = (
    courtIndex: number,
    dayOffset: number,
    start: IsoTime,
    hours: number,
    status: ReservationStatus,
    customerName: string,
    customerEmail: string,
    customerPhone: string,
  ) => {
    const court = d.courts[courtIndex];
    const at = nowIso();
    const r: Reservation = {
      id: uuid(),
      reservationCode: newCode(d),
      courtId: court.id,
      reservationDate: addDays(today, dayOffset),
      startTime: start,
      endTime: minutesToTime(timeToMinutes(start) + hours * 60),
      status,
      amount: { amount: court.hourlyPrice.amount * hours, currency: "COP" },
      customerName,
      customerEmail,
      customerPhone,
      cancelledAt: status === "CANCELLED" ? at : null,
      cancelledBy: status === "CANCELLED" ? "CUSTOMER" : null,
      cancellationReason: status === "CANCELLED" ? "No podemos asistir" : null,
      createdAt: at,
      updatedAt: at,
    };
    d.reservations.push(r);
    const paymentStatus: PaymentStatus =
      status === "CONFIRMED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : status === "CANCELLED" ? "REFUNDED" : "PENDING";
    d.payments.push({
      id: uuid(),
      reservationId: r.id,
      reservationCode: r.reservationCode,
      amount: r.amount,
      status: paymentStatus,
      wompiTransactionId: paymentStatus === "PENDING" ? null : `MOCK-${uuid().slice(0, 8).toUpperCase()}`,
      createdAt: at,
      updatedAt: at,
    });
  };

  seedReservation(0, 0, "18:00:00", 2, "CONFIRMED", "Juan Pérez", "juan@example.com", "+573001234567");
  seedReservation(0, 0, "20:00:00", 1, "PENDING", "Laura Gómez", "laura@example.com", "+573109876543");
  seedReservation(1, 0, "19:00:00", 1, "CONFIRMED", "Andrés Torres", "andres@example.com", "+573201112233");
  seedReservation(2, 0, "17:00:00", 2, "CANCELLED", "María López", "maria@example.com", "+573154445566");
  seedReservation(0, 1, "19:00:00", 1, "CONFIRMED", "Sofía Ramírez", "sofia@example.com", "+573123334455");
  seedReservation(1, 1, "20:00:00", 2, "CONFIRMED", "Diego Herrera", "diego@example.com", "+573056667788");
  seedReservation(2, 2, "18:00:00", 1, "PENDING", "Felipe Mora", "felipe@example.com", "+573221223344");
  seedReservation(0, -1, "18:00:00", 1, "CONFIRMED", "Natalia Cruz", "natalia@example.com", "+573189990011");
  seedReservation(1, -1, "20:00:00", 1, "REJECTED", "Camilo Ríos", "camilo@example.com", "+573145556677");

  return d;
}

// ─── Persistencia ────────────────────────────────────────────────────────────

let db: Db | null = null;

function getDb(): Db {
  if (!db) {
    const stored = readJson<Db>("local", STORAGE_KEY);
    db = stored && stored.version === DB_VERSION ? stored : seed();
  }
  return db;
}

function persist(): void {
  if (db) writeJson("local", STORAGE_KEY, db);
}

/** Borra los datos simulados; el próximo acceso vuelve a sembrarlos. */
export function resetMockDb(): void {
  removeKey("local", STORAGE_KEY);
  db = null;
}

// ─── Eventos de dominio (RabbitMQ simulado) ──────────────────────────────────

function publish(d: Db, type: EventType, reservationId: string, delayMs: number): void {
  d.events.push({ eventId: uuid(), type, reservationId, applyAt: Date.now() + delayMs });
}

function tick(d: Db): void {
  const now = Date.now();
  const due = d.events.filter((e) => e.applyAt <= now).sort((a, b) => a.applyAt - b.applyAt);
  d.events = d.events.filter((e) => e.applyAt > now);

  for (const event of due) {
    if (d.processedEvents.includes(event.eventId)) continue; // consumidor idempotente (P6)
    d.processedEvents.push(event.eventId);

    const reservation = d.reservations.find((r) => r.id === event.reservationId);
    const payment = d.payments.find((p) => p.reservationId === event.reservationId);
    const at = nowIso();

    switch (event.type) {
      case "ReservationCreated":
        // payment-service registra el pago PENDING
        if (reservation && !payment) {
          d.payments.push({
            id: uuid(),
            reservationId: reservation.id,
            reservationCode: reservation.reservationCode,
            amount: reservation.amount,
            status: "PENDING",
            wompiTransactionId: null,
            createdAt: at,
            updatedAt: at,
          });
        }
        break;
      case "PaymentApproved":
        if (reservation?.status === "PENDING") {
          reservation.status = "CONFIRMED";
          reservation.updatedAt = at;
        } else if (reservation?.status === "CANCELLED" && payment) {
          // Compensación: pago aprobado para una reserva ya cancelada (ADR-005 pendiente)
          payment.status = "REFUNDED";
          payment.updatedAt = at;
        }
        break;
      case "PaymentRejected":
        if (reservation?.status === "PENDING") {
          reservation.status = "REJECTED";
          reservation.updatedAt = at;
        }
        break;
      case "ReservationCancelled":
        if (payment?.status === "APPROVED") {
          payment.status = "REFUNDED";
          payment.updatedAt = at;
        }
        break;
    }
  }
  d.processedEvents = d.processedEvents.slice(-500);
}

// ─── Utilidades HTTP ─────────────────────────────────────────────────────────

interface Ctx {
  d: Db;
  params: string[];
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}

type Handler = (ctx: Ctx) => ApiRawResponse;

const ok = (body: unknown, status = 200): ApiRawResponse => ({ status, body });
const empty = (status: number): ApiRawResponse => ({ status, body: undefined });

function fail(status: number, error: string, message: string, details?: ErrorDetail[]): ApiRawResponse {
  return { status, body: { error, message, ...(details && details.length ? { details } : {}), traceId: uuid() } };
}

const notFound = () => fail(404, "NOT_FOUND", "The requested resource was not found");
const invalid = (details: ErrorDetail[]) => fail(400, "VALIDATION_ERROR", "Invalid request data", details);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const isMoney = (v: unknown): v is Money =>
  isObj(v) && Number.isInteger(v.amount) && (v.amount as number) > 0 && v.currency === "COP";

function unknownFields(body: Record<string, unknown>, allowed: string[]): ErrorDetail[] {
  return Object.keys(body)
    .filter((k) => !allowed.includes(k))
    .map((field) => ({ field, message: "Campo no permitido" }));
}

const isActive = (r: Reservation) => r.status === "PENDING" || r.status === "CONFIRMED";

function overlaps(d: Db, courtId: string, date: IsoDate, start: IsoTime, end: IsoTime): boolean {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return d.reservations.some(
    (r) =>
      isActive(r) &&
      r.courtId === courtId &&
      r.reservationDate === date &&
      timeToMinutes(r.startTime) < e &&
      s < timeToMinutes(r.endTime),
  );
}

const scheduleOf = (d: Db, courtId: string, day: DayOfWeek) =>
  d.schedules.find((s) => s.courtId === courtId && s.dayOfWeek === day);

/** Gateway: valida el JWT antes de enrutar las operaciones /admin/**. */
const admin =
  (handler: Handler): Handler =>
  (ctx) => {
    const header = ctx.headers["authorization"] ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const expiresAt = token ? ctx.d.accessTokens[token] : undefined;
    if (!expiresAt || expiresAt < Date.now()) return fail(401, "UNAUTHORIZED", "Authentication is required");
    return handler(ctx);
  };

// ─── court-service ───────────────────────────────────────────────────────────

const listCourts: Handler = ({ d }) => ok({ data: d.courts });

const getCourt: Handler = ({ d, params }) => {
  const court = d.courts.find((c) => c.id === params[0]);
  return court ? ok(court) : notFound();
};

const getSchedules: Handler = ({ d, params }) => {
  if (!d.courts.some((c) => c.id === params[0])) return notFound();
  const data = d.schedules
    .filter((s) => s.courtId === params[0])
    .sort((a, b) => WEEK.indexOf(a.dayOfWeek) - WEEK.indexOf(b.dayOfWeek));
  return ok({ data });
};

const updateCourt: Handler = ({ d, params, body }) => {
  const court = d.courts.find((c) => c.id === params[0]);
  if (!court) return notFound();
  if (!isObj(body) || Object.keys(body).length === 0) return invalid([{ message: "Envía al menos un campo" }]);

  const details = unknownFields(body, ["name", "capacity", "hourlyPrice", "status"]);
  if ("name" in body && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 100)) {
    details.push({ field: "name", message: "El nombre debe tener entre 1 y 100 caracteres" });
  }
  if ("capacity" in body && (!Number.isInteger(body.capacity) || (body.capacity as number) < 1)) {
    details.push({ field: "capacity", message: "La capacidad debe ser un entero mayor que 0" });
  }
  if ("hourlyPrice" in body && !isMoney(body.hourlyPrice)) {
    details.push({ field: "hourlyPrice", message: "El precio debe ser un entero en COP mayor que 0" });
  }
  if ("status" in body && !COURT_STATUSES.includes(body.status as CourtStatus)) {
    details.push({ field: "status", message: "Estado no válido" });
  }
  if (details.length) return invalid(details);

  const nextStatus = body.status as CourtStatus | undefined;
  if (nextStatus && nextStatus !== court.status && !COURT_STATUS_TRANSITIONS[court.status].includes(nextStatus)) {
    return fail(422, "INVALID_COURT_STATUS_TRANSITION", "The requested status transition is not allowed", [
      { field: "status", message: `No se puede pasar de ${court.status} a ${nextStatus}` },
    ]);
  }
  const nextName = typeof body.name === "string" ? body.name.trim() : undefined;
  if (nextName && d.courts.some((c) => c.id !== court.id && c.name.toLowerCase() === nextName.toLowerCase())) {
    return fail(409, "CONFLICT", "Another court already uses this name", [
      { field: "name", message: "Ya existe una cancha con ese nombre" },
    ]);
  }

  if (nextName) court.name = nextName;
  if (typeof body.capacity === "number") court.capacity = body.capacity;
  if (isMoney(body.hourlyPrice)) court.hourlyPrice = { amount: body.hourlyPrice.amount, currency: "COP" };
  if (nextStatus) court.status = nextStatus;
  court.updatedAt = nowIso();
  return ok(court);
};

const putSchedule: Handler = ({ d, params, body }) => {
  const [courtId, day] = params;
  if (!WEEK.includes(day as DayOfWeek)) return invalid([{ field: "dayOfWeek", message: "Día no válido" }]);
  if (!d.courts.some((c) => c.id === courtId)) return notFound();
  if (!isObj(body)) return invalid([{ message: "Cuerpo requerido" }]);

  const details = unknownFields(body, ["openingTime", "closingTime"]);
  if (typeof body.openingTime !== "string" || !TIME_RE.test(body.openingTime)) {
    details.push({ field: "openingTime", message: "Usa el formato HH:mm:ss" });
  }
  if (typeof body.closingTime !== "string" || !TIME_RE.test(body.closingTime)) {
    details.push({ field: "closingTime", message: "Usa el formato HH:mm:ss" });
  }
  if (details.length) return invalid(details);

  const openingTime = body.openingTime as IsoTime;
  const closingTime = body.closingTime as IsoTime;
  if (timeToMinutes(closingTime) <= timeToMinutes(openingTime)) {
    return fail(422, "INVALID_SCHEDULE", "The closing time must be after the opening time");
  }

  let schedule = scheduleOf(d, courtId, day as DayOfWeek);
  if (schedule) {
    schedule.openingTime = openingTime;
    schedule.closingTime = closingTime;
  } else {
    schedule = { id: uuid(), courtId, dayOfWeek: day as DayOfWeek, openingTime, closingTime };
    d.schedules.push(schedule);
  }
  return ok(schedule);
};

const deleteSchedule: Handler = ({ d, params }) => {
  const [courtId, day] = params;
  const schedule = scheduleOf(d, courtId, day as DayOfWeek);
  if (!schedule) return notFound();
  d.schedules = d.schedules.filter((s) => s !== schedule);
  return empty(204);
};

// ─── reservation-service ─────────────────────────────────────────────────────

const availability: Handler = ({ d, query }) => {
  const { courtId = "", date = "" } = query;
  const details: ErrorDetail[] = [];
  if (!UUID_RE.test(courtId)) details.push({ field: "courtId", message: "Debe ser un UUID" });
  if (!isValidIsoDate(date)) details.push({ field: "date", message: "Usa el formato YYYY-MM-DD" });
  if (details.length) return invalid(details);

  const court = d.courts.find((c) => c.id === courtId);
  if (!court) return notFound();

  const slots: Array<{ startTime: IsoTime; endTime: IsoTime; available: boolean }> = [];
  const schedule = scheduleOf(d, court.id, dayOfWeekOf(date));
  if (court.status === "ACTIVE" && schedule) {
    const close = timeToMinutes(schedule.closingTime);
    for (let t = timeToMinutes(schedule.openingTime); t + 60 <= close; t += 60) {
      const startTime = minutesToTime(t);
      const endTime = minutesToTime(t + 60);
      slots.push({ startTime, endTime, available: !overlaps(d, court.id, date, startTime, endTime) });
    }
  }
  return ok({
    courtId,
    date,
    hourlyPrice: court.hourlyPrice,
    hasAvailability: slots.some((s) => s.available),
    slots,
  });
};

const createReservation: Handler = ({ d, body, headers }) => {
  const key = headers["idempotency-key"] ?? "";
  if (!UUID_RE.test(key)) return invalid([{ field: "Idempotency-Key", message: "Cabecera requerida (UUID)" }]);
  const scope = `reservations:${key}`;
  if (d.idempotency[scope]) return d.idempotency[scope];

  if (!isObj(body)) return invalid([{ message: "Cuerpo requerido" }]);
  const details = unknownFields(body, [
    "courtId",
    "reservationDate",
    "startTime",
    "endTime",
    "customerName",
    "customerEmail",
    "customerPhone",
  ]);
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  const courtId = str("courtId");
  const date = str("reservationDate");
  const start = str("startTime");
  const end = str("endTime");
  const name = str("customerName").trim();
  const email = str("customerEmail").trim();
  const phone = str("customerPhone").trim();

  if (!UUID_RE.test(courtId)) details.push({ field: "courtId", message: "Debe ser un UUID" });
  if (!isValidIsoDate(date)) details.push({ field: "reservationDate", message: "Usa el formato YYYY-MM-DD" });
  if (!TIME_RE.test(start)) details.push({ field: "startTime", message: "Usa el formato HH:mm:ss" });
  if (!TIME_RE.test(end)) details.push({ field: "endTime", message: "Usa el formato HH:mm:ss" });
  if (!name || name.length > 150) details.push({ field: "customerName", message: "Nombre requerido (máx. 150)" });
  if (!EMAIL_RE.test(email) || email.length > 255) details.push({ field: "customerEmail", message: "Correo no válido" });
  if (phone.length < 7 || phone.length > 30) details.push({ field: "customerPhone", message: "Teléfono no válido" });
  if (details.length) return invalid(details);

  const court = d.courts.find((c) => c.id === courtId);
  if (!court) return fail(404, "COURT_NOT_FOUND", "The requested court was not found");

  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const schedule = scheduleOf(d, court.id, dayOfWeekOf(date));
  const rules: ErrorDetail[] = [];
  if (court.status !== "ACTIVE") rules.push({ field: "courtId", message: "La cancha no está disponible para reservas" });
  if (date < todayIso()) rules.push({ field: "reservationDate", message: "La fecha no puede estar en el pasado" });
  if (e <= s) rules.push({ field: "endTime", message: "La hora final debe ser posterior a la inicial" });
  else if ((e - s) % 60 !== 0) rules.push({ field: "endTime", message: "La reserva debe cubrir horas completas" });
  if (!schedule || s < timeToMinutes(schedule.openingTime) || e > timeToMinutes(schedule.closingTime)) {
    rules.push({ field: "startTime", message: "La franja está fuera del horario de la cancha" });
  }
  if (rules.length) {
    return fail(422, "BUSINESS_RULE_VIOLATION", "The reservation does not satisfy the required business rules", rules);
  }

  if (overlaps(d, court.id, date, start, end)) {
    return fail(409, "RESERVATION_SLOT_UNAVAILABLE", "The requested time slot is no longer available");
  }

  const at = nowIso();
  const reservation: Reservation = {
    id: uuid(),
    reservationCode: newCode(d),
    courtId: court.id,
    reservationDate: date,
    startTime: start,
    endTime: end,
    status: "PENDING",
    amount: { amount: (court.hourlyPrice.amount * (e - s)) / 60, currency: "COP" },
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    createdAt: at,
    updatedAt: at,
  };
  d.reservations.push(reservation);
  publish(d, "ReservationCreated", reservation.id, 1500);

  const response = ok(reservation, 201);
  d.idempotency[scope] = response;
  return response;
};

const getReservation: Handler = ({ d, params }) => {
  const code = params[0];
  const reservation = CODE_RE.test(code) ? d.reservations.find((r) => r.reservationCode === code) : undefined;
  return reservation ? ok(reservation) : notFound(); // mismo 404 para código inexistente o mal formado
};

function cancel(d: Db, reservation: Reservation, by: CancelledBy, body: unknown): ApiRawResponse {
  if (body !== undefined && body !== null && !isObj(body)) return invalid([{ message: "Cuerpo no válido" }]);
  const details = isObj(body) ? unknownFields(body, ["reason"]) : [];
  const reason = isObj(body) ? body.reason : undefined;
  if (reason !== undefined && (typeof reason !== "string" || reason.length > 255)) {
    details.push({ field: "reason", message: "Máximo 255 caracteres" });
  }
  if (details.length) return invalid(details);

  if (!isActive(reservation)) {
    return fail(409, "RESERVATION_NOT_CANCELLABLE", "The reservation can no longer be cancelled");
  }
  const at = nowIso();
  reservation.status = "CANCELLED";
  reservation.cancelledAt = at;
  reservation.cancelledBy = by;
  reservation.cancellationReason = typeof reason === "string" && reason.trim() ? reason.trim() : null;
  reservation.updatedAt = at;
  publish(d, "ReservationCancelled", reservation.id, 800);
  return ok(reservation);
}

const cancelByCode: Handler = ({ d, params, body }) => {
  const code = params[0];
  const reservation = CODE_RE.test(code) ? d.reservations.find((r) => r.reservationCode === code) : undefined;
  return reservation ? cancel(d, reservation, "CUSTOMER", body) : notFound();
};

const cancelById: Handler = ({ d, params, body }) => {
  const reservation = d.reservations.find((r) => r.id === params[0]);
  return reservation ? cancel(d, reservation, "ADMINISTRATOR", body) : notFound();
};

const listReservations: Handler = ({ d, query }) => {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 20;
  const details: ErrorDetail[] = [];
  if (!Number.isInteger(page) || page < 1) details.push({ field: "page", message: "Debe ser un entero desde 1" });
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) details.push({ field: "limit", message: "Entre 1 y 100" });
  if (query.status && !RESERVATION_STATUSES.includes(query.status as ReservationStatus)) {
    details.push({ field: "status", message: "Estado no válido" });
  }
  if (query.courtId && !UUID_RE.test(query.courtId)) details.push({ field: "courtId", message: "Debe ser un UUID" });
  if (query.dateFrom && !isValidIsoDate(query.dateFrom)) details.push({ field: "dateFrom", message: "YYYY-MM-DD" });
  if (query.dateTo && !isValidIsoDate(query.dateTo)) details.push({ field: "dateTo", message: "YYYY-MM-DD" });
  if (details.length) return invalid(details);

  const rows = d.reservations
    .filter((r) => !query.status || r.status === query.status)
    .filter((r) => !query.courtId || r.courtId === query.courtId)
    .filter((r) => !query.dateFrom || r.reservationDate >= query.dateFrom)
    .filter((r) => !query.dateTo || r.reservationDate <= query.dateTo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return ok({
    data: rows.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) },
  });
};

// ─── payment-service ─────────────────────────────────────────────────────────

const startCheckout: Handler = ({ d, body, headers }) => {
  const key = headers["idempotency-key"] ?? "";
  if (!UUID_RE.test(key)) return invalid([{ field: "Idempotency-Key", message: "Cabecera requerida (UUID)" }]);
  const scope = `checkouts:${key}`;
  if (d.idempotency[scope]) return d.idempotency[scope];

  const code = isObj(body) && typeof body.reservationCode === "string" ? body.reservationCode : "";
  if (!CODE_RE.test(code)) return invalid([{ field: "reservationCode", message: "Código no válido" }]);

  const reservation = d.reservations.find((r) => r.reservationCode === code);
  const payment = reservation ? d.payments.find((p) => p.reservationId === reservation.id) : undefined;
  // Mismo 404 si el código no existe o si el pago aún no se ha registrado (consistencia eventual)
  if (!reservation || !payment) return notFound();
  if (payment.status !== "PENDING" || reservation.status !== "PENDING") {
    return fail(409, "PAYMENT_NOT_PENDING", "The payment for this reservation can no longer be started");
  }

  const transaction = payment.wompiTransactionId ?? `MOCK-${uuid().slice(0, 8).toUpperCase()}`;
  payment.wompiTransactionId = transaction;
  payment.updatedAt = nowIso();
  const checkoutUrl = `${window.location.origin}/mock/wompi?${new URLSearchParams({ transaction, code })}`;

  const response = ok({ status: "PENDING", amount: payment.amount, checkoutUrl }, 201);
  d.idempotency[scope] = response;
  return response;
};

/** Simplificación del webhook: Wompi real envía su propio formato, leído solo por el ACL. */
const wompiWebhook: Handler = ({ d, body, headers }) => {
  if (headers["x-event-checksum"] !== MOCK_WEBHOOK_SIGNATURE) return empty(401);
  if (!isObj(body) || typeof body.transactionId !== "string" || !["APPROVED", "DECLINED"].includes(body.status as string)) {
    return invalid([{ message: "Evento no válido" }]);
  }
  const payment = d.payments.find((p) => p.wompiTransactionId === body.transactionId);
  if (!payment) return invalid([{ field: "transactionId", message: "Transacción desconocida" }]);
  if (payment.status !== "PENDING") return empty(200); // repetido: se reconoce sin cambios

  const approved = body.status === "APPROVED";
  payment.status = approved ? "APPROVED" : "REJECTED";
  payment.updatedAt = nowIso();
  publish(d, approved ? "PaymentApproved" : "PaymentRejected", payment.reservationId, 1200);
  return empty(200);
};

// ─── user-service ────────────────────────────────────────────────────────────

function issueTokens(d: Db): AuthResponse {
  const now = Date.now();
  for (const [token, expiresAt] of Object.entries(d.accessTokens)) {
    if (expiresAt < now) delete d.accessTokens[token];
  }
  const accessToken = `mock-access.${uuid()}`;
  const refreshToken = `mock-refresh.${uuid()}`;
  d.accessTokens[accessToken] = now + ACCESS_TOKEN_TTL_MS;
  d.refreshTokens.push(refreshToken);
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_MS / 1000, user: MOCK_ADMIN.summary };
}

const login: Handler = ({ d, body }) => {
  if (!isObj(body)) return invalid([{ message: "Cuerpo requerido" }]);
  const details = unknownFields(body, ["email", "password"]);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!EMAIL_RE.test(email) || email.length > 255) details.push({ field: "email", message: "Correo no válido" });
  if (password.length < 8 || password.length > 100) details.push({ field: "password", message: "Entre 8 y 100 caracteres" });
  if (details.length) return invalid(details);

  if (email.toLowerCase() !== MOCK_ADMIN.email || password !== MOCK_ADMIN.password) {
    return fail(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  return ok(issueTokens(d));
};

const refresh: Handler = ({ d, body }) => {
  const token = isObj(body) && typeof body.refreshToken === "string" ? body.refreshToken : "";
  if (!token) return invalid([{ field: "refreshToken", message: "Requerido" }]);
  const index = d.refreshTokens.indexOf(token);
  if (index === -1) return fail(401, "INVALID_REFRESH_TOKEN", "The refresh token is invalid or expired");
  d.refreshTokens.splice(index, 1); // rotación: un refresh token se usa una sola vez
  return ok(issueTokens(d));
};

const logout: Handler = ({ d, body }) => {
  if (isObj(body) && body.allDevices === true) d.refreshTokens = [];
  else if (isObj(body) && typeof body.refreshToken === "string") {
    d.refreshTokens = d.refreshTokens.filter((t) => t !== body.refreshToken);
  }
  return empty(204);
};

// ─── Gateway: tabla de rutas ─────────────────────────────────────────────────

const routes: Array<[HttpMethod, RegExp, Handler]> = [
  ["GET", /^\/health$/, () =>
    ok({
      status: "ok",
      timestamp: nowIso(),
      upstreams: { "user-service": "ok", "court-service": "ok", "reservation-service": "ok", "payment-service": "ok" },
    })],
  ["GET", /^\/courts$/, listCourts],
  ["GET", /^\/courts\/([^/]+)$/, getCourt],
  ["GET", /^\/courts\/([^/]+)\/schedules$/, getSchedules],
  ["PATCH", /^\/admin\/courts\/([^/]+)$/, admin(updateCourt)],
  ["PUT", /^\/admin\/courts\/([^/]+)\/schedules\/([^/]+)$/, admin(putSchedule)],
  ["DELETE", /^\/admin\/courts\/([^/]+)\/schedules\/([^/]+)$/, admin(deleteSchedule)],
  ["GET", /^\/availability$/, availability],
  ["POST", /^\/reservations$/, createReservation],
  ["GET", /^\/reservations\/([^/]+)$/, getReservation],
  ["POST", /^\/reservations\/([^/]+)\/cancellation$/, cancelByCode],
  ["GET", /^\/admin\/reservations$/, admin(listReservations)],
  ["POST", /^\/admin\/reservations\/([^/]+)\/cancellation$/, admin(cancelById)],
  ["POST", /^\/payments\/checkouts$/, startCheckout],
  ["POST", /^\/payments\/wompi\/webhook$/, wompiWebhook],
  ["POST", /^\/auth\/login$/, login],
  ["POST", /^\/auth\/refresh$/, refresh],
  ["POST", /^\/auth\/logout$/, admin(logout)],
  ["GET", /^\/auth\/jwks$/, () => ok({ keys: [] })],
];

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function mockTransport(req: ApiRequest): Promise<ApiRawResponse> {
  await new Promise((resolve) => window.setTimeout(resolve, 150 + Math.random() * 250)); // latencia de red

  const d = getDb();
  tick(d);

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers ?? {})) headers[k.toLowerCase()] = v;
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query ?? {})) if (v !== undefined && v !== "") query[k] = String(v);

  let res = notFound();
  for (const [method, pattern, handler] of routes) {
    if (method !== req.method) continue;
    const match = pattern.exec(req.path);
    if (match) {
      res = handler({ d, params: match.slice(1).map(safeDecode), query, body: req.body, headers });
      break;
    }
  }

  persist();
  // Copia profunda: la UI nunca comparte objetos con la "base de datos".
  return { status: res.status, body: res.body === undefined ? undefined : JSON.parse(JSON.stringify(res.body)) };
}
