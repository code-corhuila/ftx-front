import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiRawResponse } from "../client";
import type { ErrorResponse } from "../types";
import { mockTransport, resetMockDb } from "./server";

// Solicitudes directas a POST /reservations, como si alguien manipulara la interfaz o llamara
// a la API sin ella. Solo se simula `Date`, así que la hora del "sistema" queda fija.

const COURT_2 = "2b8d5f1a-6c3e-4d7b-8a9f-0e1d2c3b4a51"; // lun–vie 08–22, sáb–dom 07–23

function createReservation(reservationDate: string, startTime: string, endTime: string): Promise<ApiRawResponse> {
  return mockTransport({
    method: "POST",
    path: "/reservations",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: {
      courtId: COURT_2,
      reservationDate,
      startTime,
      endTime,
      customerName: "Cliente Prueba",
      customerEmail: "cliente@example.com",
      customerPhone: "+573001234567",
    },
  });
}

const fields = (res: ApiRawResponse) => ((res.body as ErrorResponse).details ?? []).map((d) => d.field);

function setBusinessTime(utcIso: string) {
  vi.setSystemTime(new Date(utcIso));
  resetMockDb(); // los datos de ejemplo se siembran relativos al "hoy" del negocio
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.stubGlobal("window", {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    location: { origin: "http://localhost:5173" },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("POST /reservations — no se puede reservar una hora que ya pasó", () => {
  beforeEach(() => setBusinessTime("2026-10-13T23:00:00Z")); // martes, 18:00 en Bogotá

  it("rechaza una hora pasada del mismo día con 422 en startTime", async () => {
    const res = await createReservation("2026-10-13", "17:00:00", "18:00:00");
    expect(res.status).toBe(422);
    expect((res.body as ErrorResponse).error).toBe("BUSINESS_RULE_VIOLATION");
    expect(fields(res)).toContain("startTime");
  });

  it("rechaza 17:59 cuando son las 18:00 aunque la solicitud evite la interfaz", async () => {
    const res = await createReservation("2026-10-13", "17:59:00", "18:59:00");
    expect(res.status).toBe(422);
    expect(fields(res)).toContain("startTime");
  });

  it("acepta la franja que empieza exactamente a la hora actual", async () => {
    const res = await createReservation("2026-10-13", "18:00:00", "19:00:00");
    expect(res.status).toBe(201);
  });

  it("acepta una hora futura del mismo día", async () => {
    const res = await createReservation("2026-10-13", "20:00:00", "21:00:00");
    expect(res.status).toBe(201);
  });

  it("acepta una fecha futura", async () => {
    const res = await createReservation("2026-10-14", "08:00:00", "09:00:00");
    expect(res.status).toBe(201);
  });

  it("sigue rechazando fechas pasadas con 422 en reservationDate", async () => {
    const res = await createReservation("2026-10-12", "20:00:00", "21:00:00");
    expect(res.status).toBe(422);
    expect(fields(res)).toContain("reservationDate");
  });

  it("mantiene las demás reglas: una hora futura fuera del horario se rechaza", async () => {
    const res = await createReservation("2026-10-13", "22:00:00", "23:00:00");
    expect(res.status).toBe(422);
    expect(fields(res)).toContain("startTime");
  });
});

describe("POST /reservations — zona horaria del negocio", () => {
  it("usa la fecha de Bogotá aunque en UTC ya sea el día siguiente", async () => {
    setBusinessTime("2026-10-14T01:30:00Z"); // 20:30 del 13 en Bogotá
    expect((await createReservation("2026-10-13", "21:00:00", "22:00:00")).status).toBe(201);
    expect((await createReservation("2026-10-13", "20:00:00", "21:00:00")).status).toBe(422);
  });

  it("funciona al cambiar de mes", async () => {
    setBusinessTime("2026-11-01T04:30:00Z"); // sábado 31 de octubre, 23:30 en Bogotá
    expect((await createReservation("2026-10-31", "22:00:00", "23:00:00")).status).toBe(422);
    expect((await createReservation("2026-11-01", "07:00:00", "08:00:00")).status).toBe(201);
  });
});
