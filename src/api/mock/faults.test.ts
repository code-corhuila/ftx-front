import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  callWompi,
  FAILURE_THRESHOLD,
  isFaultActive,
  OPEN_STATE_MS,
  resetCircuit,
  setFault,
  subscribeFaults,
} from "./faults";

beforeEach(() => {
  resetCircuit();
});

describe("fallas inyectables", () => {
  it("ninguna está activa por defecto", () => {
    expect(isFaultActive("wompi-down")).toBe(false);
    expect(callWompi(0)).toBe("ok");
  });

  it("se activan y desactivan, y avisan a los suscriptores", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFaults(listener);

    setFault("wompi-down", true);
    expect(isFaultActive("wompi-down")).toBe(true);
    setFault("wompi-down", false);
    expect(isFaultActive("wompi-down")).toBe(false);

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

describe("circuit breaker de payment-service hacia Wompi (HU-PAY-006)", () => {
  it("AC1: tras el umbral de fallos responde de inmediato sin llamar a Wompi", () => {
    setFault("wompi-down", true);

    const outcomes = Array.from({ length: FAILURE_THRESHOLD }, (_, i) => callWompi(i));
    expect(outcomes).toEqual(Array(FAILURE_THRESHOLD).fill("timeout"));
    expect(callWompi(FAILURE_THRESHOLD)).toBe("fail-fast");
    expect(callWompi(OPEN_STATE_MS - 1)).toBe("fail-fast");
  });

  it("AC2: cuando Wompi vuelve, la llamada de prueba cierra el circuito", () => {
    setFault("wompi-down", true);
    for (let i = 0; i < FAILURE_THRESHOLD; i++) callWompi(0);
    setFault("wompi-down", false);

    expect(callWompi(1)).toBe("fail-fast"); // sigue abierto hasta que vence el intervalo
    expect(callWompi(OPEN_STATE_MS)).toBe("ok"); // llamada de prueba exitosa
    expect(callWompi(OPEN_STATE_MS + 1)).toBe("ok");
  });

  it("si Wompi sigue caído, la llamada de prueba vuelve a abrir el circuito", () => {
    setFault("wompi-down", true);
    for (let i = 0; i < FAILURE_THRESHOLD; i++) callWompi(0);

    expect(callWompi(OPEN_STATE_MS)).toBe("timeout");
    expect(callWompi(OPEN_STATE_MS + 1)).toBe("fail-fast");
  });

  it("un éxito antes del umbral reinicia el contador de fallos", () => {
    setFault("wompi-down", true);
    callWompi(0);
    callWompi(1);
    setFault("wompi-down", false);
    expect(callWompi(2)).toBe("ok");

    setFault("wompi-down", true);
    expect(callWompi(3)).toBe("timeout");
    expect(callWompi(4)).toBe("timeout"); // segundo fallo seguido: todavía bajo el umbral
  });
});
