import { parseRealDomains } from "./api/routing";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const rawTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);

export const config = {
  /** Origen del API Gateway, sin barra final. Vacío = mismo origen que el frontend. */
  apiBaseUrl: rawBaseUrl.replace(/\/+$/, ""),
  /** Backend simulado en el navegador, para trabajar sin gateway ni microservicios. */
  mock: import.meta.env.VITE_API_MOCK === "true",
  /**
   * Modo mixto (solo con mock=true): servicios que se llaman de verdad aunque el resto esté
   * simulado. Por ejemplo "auth,courts,schedules" mientras reservas y pagos no existen.
   */
  realDomains: parseRealDomains(import.meta.env.VITE_API_REAL_DOMAINS),
  /** Tiempo máximo de espera de cada petición; pasado ese tiempo la UI deja de esperar. */
  apiTimeoutMs: Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 10_000,
};

/** Ruta base pública de la API (07-api/guidelines.md §1). */
export const API_PREFIX = "/api/v1";
