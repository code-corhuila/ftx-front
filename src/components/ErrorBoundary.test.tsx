import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

let shouldThrow = true;

function Fragile() {
  if (shouldThrow) throw new Error("render failed");
  return <p>contenido</p>;
}

describe("ErrorBoundary", () => {
  it("muestra un aviso con reintento en lugar de una pantalla en blanco", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <Fragile />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert").textContent).toContain("Algo salió mal al mostrar esta página");
    expect(screen.getByRole("link", { name: "Volver al inicio" }).getAttribute("href")).toBe("/");

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(screen.getByText("contenido")).toBeTruthy();
  });

  it("sin errores muestra el contenido normal", () => {
    shouldThrow = false;
    render(
      <ErrorBoundary>
        <Fragile />
      </ErrorBoundary>,
    );
    expect(screen.getByText("contenido")).toBeTruthy();
  });
});
