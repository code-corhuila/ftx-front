import { describe, expect, it } from "vitest";
import { ApiError, NetworkError } from "../api/client";
import { errorMessage, fieldErrors, generalDetails, isApiError } from "./errors";

const apiError = (status: number, error: string, details?: Array<{ field?: string; message?: string }>) =>
  new ApiError(status, { error, message: "English message from the backend", details });

describe("errorMessage", () => {
  it("traduce por el código estable de ErrorResponse, nunca por el texto", () => {
    expect(errorMessage(apiError(409, "RESERVATION_SLOT_UNAVAILABLE"))).toBe("Esa franja acaba de ser reservada.");
    expect(errorMessage(apiError(409, "RESERVATION_NOT_CANCELLABLE"))).toBe("Esta reserva ya no se puede cancelar.");
    expect(errorMessage(apiError(422, "BUSINESS_RULE_VIOLATION"))).toContain("reglas de la cancha");
  });

  it("recurre al estado HTTP cuando el código no es conocido", () => {
    expect(errorMessage(apiError(401, "X"))).toBe("Tu sesión expiró. Inicia sesión de nuevo.");
    expect(errorMessage(apiError(403, "X"))).toBe("No tienes permiso para ver esto.");
    expect(errorMessage(apiError(404, "X"))).toBe("No encontramos lo que buscas.");
    expect(errorMessage(apiError(429, "X"))).toContain("Demasiados intentos");
    expect(errorMessage(apiError(503, "X"))).toContain("no está disponible");
    expect(errorMessage(apiError(500, "X"))).toBe("Ocurrió un error inesperado. Intenta de nuevo.");
    expect(errorMessage(apiError(418, "X"))).toBe("No pudimos completar la operación.");
  });

  it("distingue la falta de conexión y los errores que no vienen de la API", () => {
    expect(errorMessage(new NetworkError())).toContain("Sin conexión");
    expect(errorMessage(new Error("boom"))).toBe("Ocurrió un error inesperado.");
  });
});

describe("detalles de ErrorResponse", () => {
  const err = apiError(422, "BUSINESS_RULE_VIOLATION", [
    { field: "customer_email", message: "Correo no válido" },
    { field: "startTime", message: "Fuera del horario" },
    { message: "Regla general" },
    { field: "sinMensaje" },
  ]);

  it("fieldErrors agrupa por campo en camelCase e ignora los detalles incompletos", () => {
    expect(fieldErrors(err)).toEqual({ customerEmail: "Correo no válido", startTime: "Fuera del horario" });
    expect(fieldErrors(new Error("x"))).toEqual({});
  });

  it("generalDetails devuelve solo los mensajes sin campo", () => {
    expect(generalDetails(err)).toEqual(["Regla general"]);
    expect(generalDetails(null)).toEqual([]);
  });

  it("isApiError filtra por estado", () => {
    expect(isApiError(err)).toBe(true);
    expect(isApiError(err, 422)).toBe(true);
    expect(isApiError(err, 404)).toBe(false);
    expect(isApiError(new NetworkError())).toBe(false);
  });
});
