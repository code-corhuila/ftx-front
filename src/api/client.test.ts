import { afterEach, describe, expect, it, vi } from "vitest";
import { errorBody, stubGateway } from "../test/http";
import { authApi } from "./auth";
import { ApiError, apiRequest, NetworkError, registerAuthHooks } from "./client";
import { courtsApi } from "./courts";
import { paymentsApi } from "./payments";
import { reservationsApi } from "./reservations";

const COURT_ID = "7c0f4c3e-2a55-4a3b-9f0d-1b8f6e2a9c11";
const KEY = "0b6c2a56-6d4e-4a8e-9a43-8c1f0f5e2d11";

afterEach(() => {
  vi.useRealTimers();
});

describe("apiRequest", () => {
  it("llama al gateway bajo /api/v1 y omite los parámetros vacíos", async () => {
    const calls = stubGateway({ status: 200, body: { courtId: COURT_ID, slots: [] } });

    await reservationsApi.availability(COURT_ID, "2026-10-20");
    await apiRequest({ method: "GET", path: "/admin/reservations", query: { status: undefined, courtId: "", page: 2 } });

    expect(calls[0].url.origin).toBe("http://gateway.test");
    expect(calls[0].url.pathname).toBe("/api/v1/availability");
    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({ courtId: COURT_ID, date: "2026-10-20" });
    expect(Object.fromEntries(calls[1].url.searchParams)).toEqual({ page: "2" });
    expect(calls[0].headers.get("Accept")).toBe("application/json");
  });

  it("devuelve el cuerpo de una respuesta 2xx y undefined en un 204", async () => {
    stubGateway({ status: 200, body: { ok: true } }, { status: 204 });

    await expect(apiRequest({ method: "GET", path: "/health" })).resolves.toEqual({ ok: true });
    await expect(apiRequest({ method: "DELETE", path: "/x" })).resolves.toBeUndefined();
  });

  it("convierte un ErrorResponse en ApiError con su código, mensaje y detalles", async () => {
    const body = errorBody("VALIDATION_ERROR", "Invalid request data", [{ field: "date", message: "YYYY-MM-DD" }]);
    stubGateway({ status: 400, body });

    const err = await apiRequest({ method: "GET", path: "/availability" }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "VALIDATION_ERROR", message: "Invalid request data", body });
  });

  it("usa HTTP_<status> cuando el cuerpo no es un ErrorResponse", async () => {
    stubGateway({ status: 502, body: "<html>Bad Gateway</html>" });

    const err = await apiRequest({ method: "POST", path: "/reservations" }).catch((e: unknown) => e);

    expect(err).toMatchObject({ status: 502, code: "HTTP_502", body: { error: "HTTP_502" } });
  });

  it("reintenta las lecturas tres veces ante fallos de red antes de rendirse", async () => {
    vi.useFakeTimers();
    const calls = stubGateway(new TypeError("Failed to fetch"));

    const result = expect(courtsApi.list()).rejects.toBeInstanceOf(NetworkError);
    await vi.runAllTimersAsync();
    await result;

    expect(calls).toHaveLength(3);
  });

  it("no reintenta las escrituras ante fallos de red", async () => {
    const calls = stubGateway(new TypeError("Failed to fetch"));

    await expect(paymentsApi.startCheckout("FTXABC1234", KEY)).rejects.toBeInstanceOf(NetworkError);

    expect(calls).toHaveLength(1);
  });

  it("adjunta el token, lo renueva ante un 401 y repite la petición una vez", async () => {
    let token = "old";
    const refresh = vi.fn(async () => {
      token = "new";
      return true;
    });
    const onUnauthorized = vi.fn();
    registerAuthHooks({ getAccessToken: () => token, refresh, onUnauthorized });
    const calls = stubGateway({ status: 401, body: errorBody("UNAUTHORIZED") }, { status: 200, body: { data: [] } });

    await reservationsApi.adminList({});

    expect(calls.map((c) => c.headers.get("Authorization"))).toEqual(["Bearer old", "Bearer new"]);
    expect(refresh).toHaveBeenCalledOnce();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("cierra la sesión si el 401 persiste después de renovar", async () => {
    const onUnauthorized = vi.fn();
    registerAuthHooks({ getAccessToken: () => "t", refresh: async () => true, onUnauthorized });
    stubGateway({ status: 401, body: errorBody("UNAUTHORIZED") });

    await expect(courtsApi.update(COURT_ID, { capacity: 12 })).rejects.toMatchObject({ status: 401 });

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("las peticiones públicas nunca envían Authorization", async () => {
    registerAuthHooks({ getAccessToken: () => "t", refresh: async () => true, onUnauthorized: () => {} });
    const calls = stubGateway({ status: 200, body: {} });

    await reservationsApi.getByCode("FTXABC1234");

    expect(calls[0].headers.has("Authorization")).toBe(false);
  });
});

describe("clientes por servicio", () => {
  it("reservationsApi.create envía el cuerpo y la Idempotency-Key", async () => {
    const calls = stubGateway({ status: 201, body: { reservationCode: "FTXABC1234" } });
    const body = {
      courtId: COURT_ID,
      reservationDate: "2026-10-20",
      startTime: "18:00:00",
      endTime: "19:00:00",
      customerName: "Ana",
      customerEmail: "ana@example.com",
      customerPhone: "+573001234567",
    };

    await reservationsApi.create(body, KEY);

    expect(calls[0]).toMatchObject({ method: "POST", body });
    expect(calls[0].url.pathname).toBe("/api/v1/reservations");
    expect(calls[0].headers.get("Idempotency-Key")).toBe(KEY);
    expect(calls[0].headers.get("Content-Type")).toBe("application/json");
  });

  it("reservationsApi codifica el código de reserva en la ruta", async () => {
    const calls = stubGateway({ status: 200, body: {} });

    await reservationsApi.getByCode("A/B");
    await reservationsApi.cancelByCode("FTXABC1234", "Lluvia");
    await reservationsApi.cancelByCode("FTXABC1234");

    expect(calls[0].url.pathname).toBe("/api/v1/reservations/A%2FB");
    expect(calls[1]).toMatchObject({ method: "POST", body: { reason: "Lluvia" } });
    expect(calls[1].url.pathname).toBe("/api/v1/reservations/FTXABC1234/cancellation");
    expect(calls[2].body).toEqual({});
  });

  it("courtsApi desempaqueta las listas { data }", async () => {
    stubGateway({ status: 200, body: { data: [{ id: COURT_ID }] } });

    await expect(courtsApi.list()).resolves.toEqual([{ id: COURT_ID }]);
    await expect(courtsApi.schedules(COURT_ID)).resolves.toEqual([{ id: COURT_ID }]);
  });

  it("paymentsApi.startCheckout envía el código y la Idempotency-Key", async () => {
    const calls = stubGateway({ status: 201, body: { status: "PENDING" } });

    await paymentsApi.startCheckout("FTXABC1234", KEY);

    expect(calls[0]).toMatchObject({ method: "POST", body: { reservationCode: "FTXABC1234" } });
    expect(calls[0].url.pathname).toBe("/api/v1/payments/checkouts");
    expect(calls[0].headers.get("Idempotency-Key")).toBe(KEY);
  });

  it("authApi.refresh no intenta renovar el token ante su propio 401", async () => {
    const refresh = vi.fn(async () => true);
    registerAuthHooks({ getAccessToken: () => "t", refresh, onUnauthorized: () => {} });
    stubGateway({ status: 401, body: errorBody("INVALID_REFRESH_TOKEN") });

    await expect(authApi.refresh("r")).rejects.toMatchObject({ code: "INVALID_REFRESH_TOKEN" });

    expect(refresh).not.toHaveBeenCalled();
  });
});
