import { API_PREFIX, config } from "../config";
import type { ErrorResponse } from "./types";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequest {
  method: HttpMethod;
  /** Ruta relativa a `/api/v1`, por ejemplo `/courts`. */
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ApiRawResponse {
  status: number;
  body: unknown;
}

/** Envía una petición al API Gateway (real o simulado) y devuelve la respuesta sin interpretar. */
export type Transport = (req: ApiRequest) => Promise<ApiRawResponse>;

export interface RequestOptions extends ApiRequest {
  /** Adjunta `Authorization: Bearer` (solo operaciones de administrador). */
  auth?: boolean;
  /** No intenta renovar el token ante un 401 (refresh y logout). */
  skipAuthRefresh?: boolean;
}

/** Respuesta de error con el formato `ErrorResponse` de `_shared.yaml`. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ErrorResponse;

  constructor(status: number, body: ErrorResponse) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  get code(): string {
    return this.body.error;
  }
}

/** El servidor no respondió (sin red, gateway caído, CORS bloqueado). */
export class NetworkError extends Error {
  constructor() {
    super("Sin conexión con el servidor");
    this.name = "NetworkError";
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

// ─── Transporte HTTP real ────────────────────────────────────────────────────

const httpTransport: Transport = async (req) => {
  const origin = config.apiBaseUrl || window.location.origin;
  const url = new URL(origin + API_PREFIX + req.path);
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const headers = new Headers(req.headers);
  headers.set("Accept", "application/json");
  if (req.body !== undefined) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method,
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
    });
  } catch {
    throw new NetworkError();
  }

  const text = res.status === 204 ? "" : await res.text();
  let body: unknown;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }
  return { status: res.status, body };
};

// ─── Transporte simulado (se carga solo si VITE_API_MOCK=true) ───────────────

let mockTransportPromise: Promise<Transport> | null = null;

const mockTransport: Transport = async (req) => {
  mockTransportPromise ??= import("./mock/server").then((m) => m.mockTransport);
  return (await mockTransportPromise)(req);
};

const transport: Transport = config.mock ? mockTransport : httpTransport;

// ─── Integración con la sesión del administrador ─────────────────────────────

export interface AuthHooks {
  getAccessToken(): string | null;
  /** Renueva el access token; devuelve `true` si lo logró. */
  refresh(): Promise<boolean>;
  /** La sesión ya no es válida. */
  onUnauthorized(): void;
}

let authHooks: AuthHooks | null = null;

export function registerAuthHooks(hooks: AuthHooks): void {
  authHooks = hooks;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/** Las lecturas se reintentan ante fallos de red ("Sin conexión. Reintentando…"). */
async function send(req: ApiRequest): Promise<ApiRawResponse> {
  const attempts = req.method === "GET" ? 3 : 1;
  for (let attempt = 1; ; attempt++) {
    try {
      return await transport(req);
    } catch (err) {
      if (!(err instanceof NetworkError) || attempt >= attempts) throw err;
      await sleep(1000 * attempt);
    }
  }
}

function toErrorResponse(res: ApiRawResponse): ErrorResponse {
  const body = res.body as Partial<ErrorResponse> | undefined;
  if (body && typeof body.error === "string" && typeof body.message === "string") {
    return body as ErrorResponse;
  }
  return { error: `HTTP_${res.status}`, message: `Unexpected response ${res.status}` };
}

export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const { auth = false, skipAuthRefresh = false, ...req } = options;

  const build = (): ApiRequest => {
    const headers: Record<string, string> = { ...(req.headers ?? {}) };
    if (auth) {
      const token = authHooks?.getAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return { ...req, headers };
  };

  let res = await send(build());

  if (res.status === 401 && auth && !skipAuthRefresh && authHooks) {
    if (await authHooks.refresh()) res = await send(build());
    if (res.status === 401) authHooks.onUnauthorized();
  }

  if (res.status >= 200 && res.status < 300) return res.body as T;
  throw new ApiError(res.status, toErrorResponse(res));
}
