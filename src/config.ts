const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export const config = {
  /** Origen del API Gateway, sin barra final. Vacío = mismo origen que el frontend. */
  apiBaseUrl: rawBaseUrl.replace(/\/+$/, ""),
  /** Backend simulado en el navegador, para trabajar sin gateway ni microservicios. */
  mock: import.meta.env.VITE_API_MOCK === "true",
};

/** Ruta base pública de la API (07-api/guidelines.md §1). */
export const API_PREFIX = "/api/v1";
