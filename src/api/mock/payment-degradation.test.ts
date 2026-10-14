// Integración a través del backend simulado: la falla "wompi-down" degrada solo el pago
// (HU-PAY-006) y el resto del flujo de reservas sigue funcionando.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiRawResponse, ApiRequest } from "../client";
import type { Reservation } from "../types";
import { addDays, todayIso } from "../../lib/format";
import { FAILURE_THRESHOLD, OPEN_STATE_MS, setFault, WOMPI_TIMEOUT_MS } from "./faults";
import { mockTransport, resetMockDb } from "./server";

const COURT_2 = "2b8d5f1a-6c3e-4d7b-8a9f-0e1d2c3b4a51";
const DATE = addDays(todayIso(), 7);

/** Ejecuta una petición avanzando el reloj simulado; devuelve la respuesta y el tiempo que tardó. */
async function timed(req: ApiRequest, maxWaitMs = WOMPI_TIMEOUT_MS + 1000): Promise<{ res: ApiRawResponse; ms: number }> {
  const start = Date.now();
  const pending = mockTransport(req);
  let res: ApiRawResponse | undefined;
  void pending.then((r) => (res = r));
  for (let waited = 0; res === undefined && waited <= maxWaitMs; waited += 50) {
    await vi.advanceTimersByTimeAsync(50);
  }
  if (!res) throw new Error(`${req.method} ${req.path} did not answer within ${maxWaitMs} ms`);
  return { res, ms: Date.now() - start };
}

async function createReservation(startTime: string): Promise<Reservation> {
  const { res } = await timed({
    method: "POST",
    path: "/reservations",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: {
      courtId: COURT_2,
      reservationDate: DATE,
      startTime,
      endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00:00`,
      customerName: "Ana Ruiz",
      customerEmail: "ana@example.com",
      customerPhone: "+573001234567",
    },
  });
  expect(res.status).toBe(201);
  return res.body as Reservation;
}

const checkout = (code: string) =>
  timed({
    method: "POST",
    path: "/payments/checkouts",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: { reservationCode: code },
  });

let reservation: Reservation;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0); // latencia simulada de 150 ms
  resetMockDb();
  reservation = await createReservation("10:00:00");
  await vi.advanceTimersByTimeAsync(2000); // ReservationCreated: payment-service registra el pago PENDING
});

afterEach(() => {
  vi.useRealTimers();
});

describe("falla inyectada: Wompi no responde", () => {
  it("sin la falla, el checkout responde 201 con la URL de pago", async () => {
    const { res } = await checkout(reservation.reservationCode);
    expect(res.status).toBe(201);
  });

  it("AC1: espera el timeout de Wompi, responde 503 y, tras el umbral, falla de inmediato", async () => {
    setFault("wompi-down", true);

    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      const { res, ms } = await checkout(reservation.reservationCode);
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ error: "SERVICE_UNAVAILABLE" });
      expect(ms).toBeGreaterThanOrEqual(WOMPI_TIMEOUT_MS);
    }

    const { res, ms } = await checkout(reservation.reservationCode);
    expect(res.status).toBe(503);
    expect(ms).toBeLessThan(WOMPI_TIMEOUT_MS); // circuito abierto: no se espera a Wompi
  });

  it("el pago y la reserva siguen PENDING: no hay cobro ni cambio de estado", async () => {
    setFault("wompi-down", true);
    expect((await checkout(reservation.reservationCode)).res.status).toBe(503);

    const { res } = await timed({ method: "GET", path: `/reservations/${reservation.reservationCode}` });
    expect(res.body).toMatchObject({ status: "PENDING" });
  });

  it("AC3: con el circuito abierto, la disponibilidad y la creación de reservas siguen funcionando", async () => {
    setFault("wompi-down", true);
    for (let i = 0; i < FAILURE_THRESHOLD; i++) await checkout(reservation.reservationCode);
    expect((await checkout(reservation.reservationCode)).res.status).toBe(503); // circuito abierto

    const availability = await timed({ method: "GET", path: "/availability", query: { courtId: COURT_2, date: DATE } });
    expect(availability.res.status).toBe(200);
    expect(availability.ms).toBeLessThan(WOMPI_TIMEOUT_MS);
    await createReservation("12:00:00");
  });

  it("compensación: el cliente cancela la reserva PENDING y la franja vuelve a estar libre", async () => {
    setFault("wompi-down", true);
    expect((await checkout(reservation.reservationCode)).res.status).toBe(503);

    const cancel = await timed({
      method: "POST",
      path: `/reservations/${reservation.reservationCode}/cancellation`,
      body: { reason: "Pago no disponible" },
    });
    expect(cancel.res.body).toMatchObject({ status: "CANCELLED" });

    const { res } = await timed({ method: "GET", path: "/availability", query: { courtId: COURT_2, date: DATE } });
    const slot = (res.body as { slots: Array<{ startTime: string; available: boolean }> }).slots.find(
      (s) => s.startTime === "10:00:00",
    );
    expect(slot?.available).toBe(true);
  });

  it("AC2: cuando Wompi vuelve y vence el intervalo abierto, el checkout funciona otra vez", async () => {
    setFault("wompi-down", true);
    for (let i = 0; i < FAILURE_THRESHOLD; i++) await checkout(reservation.reservationCode);
    setFault("wompi-down", false);

    expect((await checkout(reservation.reservationCode)).res.status).toBe(503); // todavía abierto

    await vi.advanceTimersByTimeAsync(OPEN_STATE_MS);
    const { res } = await checkout(reservation.reservationCode);
    expect(res.status).toBe(201);
  });
});
