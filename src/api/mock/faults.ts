// Fallas inyectables del backend simulado (solo VITE_API_MOCK=true). Ninguna está activa por
// defecto: se activan con VITE_MOCK_FAULTS (lista separada por comas) o desde el aviso amarillo
// del modo simulado, y la elección del navegador queda en localStorage.
//
// "wompi-down" simula que Wompi Sandbox no responde. payment-service lo trata como describe
// HU-PAY-006: cada llamada espera el timeout de Wompi y responde 503 SERVICE_UNAVAILABLE; tras
// FAILURE_THRESHOLD fallos seguidos el circuito se abre y responde 503 de inmediato durante
// OPEN_STATE_MS; pasado ese tiempo, una llamada de prueba decide si se cierra o vuelve a abrirse.

import { readJson, writeJson } from "../../lib/storage";

export type MockFault = "wompi-down";

export const MOCK_FAULTS: MockFault[] = ["wompi-down"];
export const WOMPI_TIMEOUT_MS = 3000;
export const FAILURE_THRESHOLD = 3;
export const OPEN_STATE_MS = 10_000;

const KEY = "ftx.mock.faults";

function initialFaults(): MockFault[] {
  const raw = import.meta.env.VITE_MOCK_FAULTS ?? "";
  return raw
    .split(",")
    .map((f: string) => f.trim())
    .filter((f: string): f is MockFault => MOCK_FAULTS.includes(f as MockFault));
}

function activeFaults(): MockFault[] {
  return readJson<MockFault[]>("local", KEY) ?? initialFaults();
}

const listeners = new Set<() => void>();

export function isFaultActive(fault: MockFault): boolean {
  return activeFaults().includes(fault);
}

export function setFault(fault: MockFault, active: boolean): void {
  const next = new Set(activeFaults());
  if (active) next.add(fault);
  else next.delete(fault);
  writeJson("local", KEY, [...next]);
  listeners.forEach((listener) => listener());
}

export function subscribeFaults(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── Circuit breaker de payment-service hacia Wompi (HU-PAY-006) ─────────────

export type WompiOutcome = "ok" | "timeout" | "fail-fast";

let consecutiveFailures = 0;
let openUntil = 0;

/** Lo que pasa cuando payment-service intenta llamar a Wompi en el instante `now`. */
export function callWompi(now: number): WompiOutcome {
  if (now < openUntil) return "fail-fast"; // circuito abierto: no se llama a Wompi
  if (isFaultActive("wompi-down")) {
    consecutiveFailures++;
    if (consecutiveFailures >= FAILURE_THRESHOLD) openUntil = now + OPEN_STATE_MS;
    return "timeout";
  }
  consecutiveFailures = 0; // circuito cerrado, o llamada de prueba exitosa
  openUntil = 0;
  return "ok";
}

export function resetCircuit(): void {
  consecutiveFailures = 0;
  openUntil = 0;
}
