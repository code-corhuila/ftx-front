import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { errorBody, stubGateway } from "../../test/http";
import { LookupPage } from "./LookupPage";

const NOT_FOUND = /No encontramos una reserva con ese código/;

function DetailProbe() {
  return <p>detalle {useParams().code}</p>;
}

function renderLookup() {
  render(
    <MemoryRouter initialEntries={["/reservations/lookup"]}>
      <Routes>
        <Route path="/reservations/lookup" element={<LookupPage />} />
        <Route path="/reservations/:code" element={<DetailProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function lookUp(code: string) {
  fireEvent.change(screen.getByLabelText("Código de reserva"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
}

describe("LookupPage", () => {
  it("ante un 404 muestra que no encontró la reserva", async () => {
    const calls = stubGateway({ status: 404, body: errorBody("NOT_FOUND") });
    renderLookup();

    lookUp("ftx0000000");

    expect(await screen.findByText(NOT_FOUND)).toBeTruthy();
    expect(calls[0].url.pathname).toBe("/api/v1/reservations/FTX0000000");
  });

  it("un código mal formado da el mismo mensaje sin llamar a la API", async () => {
    const calls = stubGateway({ status: 200, body: {} });
    renderLookup();

    lookUp("FTX-123");

    expect(await screen.findByText(NOT_FOUND)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("si la reserva existe abre su detalle", async () => {
    stubGateway({ status: 200, body: { reservationCode: "FTX7Q2K9M4" } });
    renderLookup();

    lookUp("FTX7Q2K9M4");

    expect(await screen.findByText("detalle FTX7Q2K9M4")).toBeTruthy();
  });

  it("otros errores usan el mensaje general", async () => {
    stubGateway({ status: 503, body: errorBody("SERVICE_UNAVAILABLE") });
    renderLookup();

    lookUp("FTX7Q2K9M4");

    expect(await screen.findByText(/El servicio no está disponible/)).toBeTruthy();
  });
});
