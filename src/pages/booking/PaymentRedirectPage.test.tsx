import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import type { Reservation } from "../../api/types";
import { getBooking, saveBooking } from "../../lib/booking";
import { addDays, todayIso } from "../../lib/format";
import { errorBody, stubGateway } from "../../test/http";
import { PaymentRedirectPage } from "./PaymentRedirectPage";

const CODE = "FTX7Q2K9M4";
const DATE = addDays(todayIso(), 7);

const reservation: Reservation = {
  id: "5d2f4c1a-3b6e-4f8a-9c0d-1e2f3a4b5c6d",
  reservationCode: CODE,
  courtId: "7c0f4c3e-2a55-4a3b-9f0d-1b8f6e2a9c11",
  reservationDate: DATE,
  startTime: "18:00:00",
  endTime: "19:00:00",
  status: "PENDING",
  amount: { amount: 60000, currency: "COP" },
  customerName: "Ana Ruiz",
  customerEmail: "ana@example.com",
  customerPhone: "+573001234567",
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  createdAt: "2026-10-14T12:00:00Z",
  updatedAt: "2026-10-14T12:00:00Z",
};

function DetailProbe() {
  return <p>detalle {useParams().code}</p>;
}

function renderPayment() {
  saveBooking({
    courtId: reservation.courtId,
    courtName: "Cancha 1",
    date: DATE,
    startTime: "18:00:00",
    hourlyPrice: { amount: 60000, currency: "COP" },
    slots: [],
    hours: 1,
    customer: { customerName: "Ana Ruiz", customerPhone: "+573001234567", customerEmail: "ana@example.com" },
    reservation,
  });
  render(
    <MemoryRouter initialEntries={["/booking/payment"]}>
      <Routes>
        <Route path="/booking/payment" element={<PaymentRedirectPage />} />
        <Route path="/reservations/:code" element={<DetailProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const unavailable = () => screen.findByText("Wompi no está disponible en este momento");

describe("PaymentRedirectPage con Wompi no disponible", () => {
  it("ante 503 SERVICE_UNAVAILABLE muestra que la reserva sigue pendiente y sin cobro", async () => {
    stubGateway({ status: 503, body: errorBody("SERVICE_UNAVAILABLE") });
    renderPayment();

    expect(await unavailable()).toBeTruthy();
    expect(screen.getByText(/sigue pendiente y no se hizo ningún cobro/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar pago" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar reserva" })).toBeTruthy();
  });

  it("si el gateway no responde (falla de red) muestra el mismo estado degradado", async () => {
    stubGateway(new TypeError("Failed to fetch"));
    renderPayment();

    expect(await unavailable()).toBeTruthy();
  });

  it("Reintentar pago vuelve a llamar al checkout con la misma Idempotency-Key", async () => {
    const calls = stubGateway({ status: 503, body: errorBody("SERVICE_UNAVAILABLE") });
    renderPayment();
    await unavailable();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar pago" }));
    await unavailable();

    const checkouts = calls.filter((c) => c.url.pathname === "/api/v1/payments/checkouts");
    expect(checkouts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(checkouts.map((c) => c.headers.get("Idempotency-Key"))).size).toBe(1);
  });

  it("Cancelar reserva libera la franja: llama a la cancelación por código y abre el detalle", async () => {
    const calls = stubGateway(
      { status: 503, body: errorBody("SERVICE_UNAVAILABLE") },
      { status: 200, body: { ...reservation, status: "CANCELLED" } },
    );
    renderPayment();
    await unavailable();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar reserva" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sí, cancelar reserva" }));

    expect(await screen.findByText(`detalle ${CODE}`)).toBeTruthy();
    const cancel = calls.find((c) => c.url.pathname === `/api/v1/reservations/${CODE}/cancellation`);
    expect(cancel).toMatchObject({ method: "POST", body: { reason: "Pago no disponible" } });
    expect(getBooking()).toBeNull();
  });

  it("un 409 PAYMENT_NOT_PENDING no se trata como caída: abre el estado real de la reserva", async () => {
    stubGateway({ status: 409, body: errorBody("PAYMENT_NOT_PENDING") });
    renderPayment();

    expect(await screen.findByText(`detalle ${CODE}`)).toBeTruthy();
  });

  it("otros errores conservan el mensaje general, sin la opción de cancelar", async () => {
    stubGateway({ status: 400, body: errorBody("VALIDATION_ERROR") });
    renderPayment();

    expect(await screen.findByText("Revisa los datos marcados e inténtalo de nuevo.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancelar reserva" })).toBeNull();
  });
});
