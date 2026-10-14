import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getBooking, saveBooking } from "../../lib/booking";
import { addDays, todayIso } from "../../lib/format";
import { errorBody, stubGateway } from "../../test/http";
import { BookingDetailsPage } from "./BookingDetailsPage";
import { BookingFailedPage } from "./BookingFailedPage";

const COURT_ID = "7c0f4c3e-2a55-4a3b-9f0d-1b8f6e2a9c11";
// Siempre en el futuro: una franja que ya empezó se bloquea antes de llamar a la API.
const DATE = addDays(todayIso(), 7);

function startBooking() {
  saveBooking({
    courtId: COURT_ID,
    courtName: "Cancha 1",
    date: DATE,
    startTime: "18:00:00",
    hourlyPrice: { amount: 60000, currency: "COP" },
    slots: [{ startTime: "18:00:00", endTime: "19:00:00", available: true }],
    hours: 1,
    customer: { customerName: "Ana Ruiz", customerPhone: "+573001234567", customerEmail: "ana@example.com" },
  });
  render(
    <MemoryRouter initialEntries={["/booking/details"]}>
      <Routes>
        <Route path="/booking/details" element={<BookingDetailsPage />} />
        <Route path="/booking/failed" element={<BookingFailedPage />} />
        <Route path="/booking/payment" element={<p>pago</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Continuar al pago" }));

describe("BookingDetailsPage", () => {
  it("ante 409 RESERVATION_SLOT_UNAVAILABLE muestra la pantalla de franja ocupada conservando la fecha", async () => {
    stubGateway({ status: 409, body: errorBody("RESERVATION_SLOT_UNAVAILABLE", "The requested time slot is no longer available") });
    startBooking();

    submit();

    expect(await screen.findByRole("heading", { name: "Esa franja acaba de ser reservada" })).toBeTruthy();
    expect(screen.getByText(/No se hizo ningún cobro/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Elegir otra franja" }).getAttribute("href")).toBe(
      `/booking/availability?courtId=${COURT_ID}&date=${DATE}`,
    );
  });

  it("una regla de negocio (422) se muestra en la misma página y libera la Idempotency-Key", async () => {
    stubGateway({
      status: 422,
      body: errorBody("BUSINESS_RULE_VIOLATION", "Rules", [{ field: "startTime", message: "Fuera del horario" }]),
    });
    startBooking();

    submit();

    expect(await screen.findByText(/no cumple las reglas de la cancha/)).toBeTruthy();
    expect(screen.getByText("Fuera del horario")).toBeTruthy();
    expect(getBooking()?.reservationKey).toBeUndefined();
  });

  it("si la reserva se crea continúa al pago", async () => {
    const calls = stubGateway({ status: 201, body: { reservationCode: "FTX7Q2K9M4", reservationDate: DATE, startTime: "18:00:00" } });
    startBooking();

    submit();

    expect(await screen.findByText("pago")).toBeTruthy();
    expect(calls[0].headers.get("Idempotency-Key")).toBe(getBooking()?.reservationKey);
  });
});
