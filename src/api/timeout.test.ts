import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../config";
import { errorMessage } from "../lib/errors";
import { NetworkError, TimeoutError } from "./client";
import { paymentsApi } from "./payments";

afterEach(() => {
  vi.useRealTimers();
});

describe("timeout de las peticiones", () => {
  it("deja de esperar después de config.apiTimeoutMs y lanza TimeoutError", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => new Promise<Response>(() => {})); // el gateway nunca responde
    vi.stubGlobal("fetch", fetchMock);

    const result = expect(paymentsApi.startCheckout("FTXABC1234", crypto.randomUUID())).rejects.toBeInstanceOf(
      TimeoutError,
    );
    await vi.advanceTimersByTimeAsync(config.apiTimeoutMs);
    await result;

    expect(fetchMock).toHaveBeenCalledTimes(1); // las escrituras no se reintentan
  });

  it("el timeout es una falla de red con su propio mensaje", () => {
    const err = new TimeoutError();
    expect(err).toBeInstanceOf(NetworkError);
    expect(errorMessage(err)).toBe("El servidor tardó demasiado en responder. Intenta de nuevo en unos minutos.");
  });
});
