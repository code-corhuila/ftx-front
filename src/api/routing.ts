// Qué servicio atiende cada ruta de /api/v1 y si va al backend real o al simulado.
//
// Mientras el API Gateway no exista, el modo mixto deja usar los servicios que ya tienen código
// (usuarios en ftx-customers-api, canchas en ftx-courts-api y horarios en ftx-schedules-api) y
// mantiene simulado el resto (reservas y pagos). Las rutas siguen 07-api/contracts/openapi y el
// reparto de ADR-011 y ADR-012 en ftx-docs. vite.config.ts usa la misma tabla para el proxy de
// desarrollo, así el navegador y el proxy nunca discrepan.

export type ApiDomain = "auth" | "courts" | "schedules" | "reservations" | "payments" | "other";

export const API_DOMAINS: readonly ApiDomain[] = ["auth", "courts", "schedules", "reservations", "payments"];

/**
 * Patrón de cada servicio sobre la ruta relativa a /api/v1, en orden: gana el primero que
 * coincide. Horarios y franjas cuelgan de /courts pero viven en ftx-schedules-api (ADR-011), por
 * eso van antes que canchas.
 */
export const SERVICE_ROUTES: ReadonlyArray<readonly [Exclude<ApiDomain, "other">, string]> = [
  ["auth", "^/auth(/|$)"],
  ["schedules", "^/(admin/)?courts/[^/]+/(schedules|bookable-slots)(/|$)"],
  ["courts", "^/(admin/)?courts(/|$)"],
  ["reservations", "^/(availability|reservations|admin/reservations)(/|$)"],
  ["payments", "^/payments(/|$)"],
];

const COMPILED = SERVICE_ROUTES.map(([domain, source]) => [domain, new RegExp(source)] as const);

/** Servicio dueño de una ruta relativa a /api/v1 (sin query). */
export function domainOf(path: string): ApiDomain {
  return COMPILED.find(([, pattern]) => pattern.test(path))?.[0] ?? "other";
}

/** Lee VITE_API_REAL_DOMAINS ("auth,courts,schedules"); ignora nombres desconocidos. */
export function parseRealDomains(raw: string | undefined): ReadonlySet<ApiDomain> {
  const names = (raw ?? "").split(",").map((s) => s.trim().toLowerCase());
  return new Set(API_DOMAINS.filter((d) => names.includes(d)));
}

/**
 * true = la petición va por HTTP. Sin simulación todo es real; con simulación solo los dominios
 * listados en VITE_API_REAL_DOMAINS.
 */
export function usesRealBackend(path: string, mock: boolean, realDomains: ReadonlySet<ApiDomain>): boolean {
  if (!mock) return true;
  return realDomains.has(domainOf(path));
}
