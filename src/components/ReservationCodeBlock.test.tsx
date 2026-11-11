import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReservationCodeBlock } from "./ReservationCodeBlock";
import { ToastProvider } from "./Toast";

function renderBlock(writeText: (text: string) => Promise<void>) {
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  return render(
    <ToastProvider>
      <ReservationCodeBlock code="FTX7Q2K9M4" />
    </ToastProvider>,
  );
}

describe("ReservationCodeBlock", () => {
  it("muestra el código sin traducir y la advertencia de guardarlo", () => {
    renderBlock(async () => {});

    const code = screen.getByText("FTX7Q2K9M4");
    expect(code.getAttribute("translate")).toBe("no");
    expect(screen.getByRole("region", { name: "Código de reserva" })).toBeTruthy();
    expect(screen.getByText(/única forma de consultar tu reserva/)).toBeTruthy();
  });

  it("copia el código al portapapeles y lo confirma", async () => {
    const writeText = vi.fn(async () => {});
    renderBlock(writeText);

    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));

    expect(await screen.findByText("Código copiado")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("FTX7Q2K9M4");
  });

  it("si el portapapeles falla, pide copiarlo a mano", async () => {
    renderBlock(async () => {
      throw new Error("denied");
    });

    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));

    expect(await screen.findByText(/cópialo manualmente/)).toBeTruthy();
  });
});
