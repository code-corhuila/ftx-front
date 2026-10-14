// Sesión del administrador (07-api/authentication.md): access token JWT de 1 h y refresh
// token opaco de 7 días que rota en cada uso. Los clientes nunca tienen sesión.
//
// Se guarda en sessionStorage (solo esta pestaña) para sobrevivir a una recarga.
import { useSyncExternalStore } from "react";
import { authApi } from "../api/auth";
import { registerAuthHooks } from "../api/client";
import type { AdministratorSummary, AuthResponse } from "../api/types";
import { readJson, removeKey, writeJson } from "../lib/storage";

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AdministratorSummary;
}

const KEY = "ftx.admin.session";

let current: AdminSession | null = readJson<AdminSession>("session", KEY);
let expired = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const session = {
  get: (): AdminSession | null => current,

  /** La última sesión terminó porque el token dejó de ser válido. */
  wasExpired: (): boolean => expired,

  start(auth: AuthResponse): void {
    current = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresAt: Date.now() + auth.expiresIn * 1000,
      user: auth.user,
    };
    expired = false;
    writeJson("session", KEY, current);
    emit();
  },

  end(reason: "logout" | "expired" = "logout"): void {
    current = null;
    expired = reason === "expired";
    removeKey("session", KEY);
    emit();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// Varias peticiones pueden recibir 401 a la vez: todas esperan la misma renovación,
// porque el refresh token solo sirve una vez.
let refreshing: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
  const s = current;
  if (!s) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = authApi
      .refresh(s.refreshToken)
      .then((auth) => {
        session.start(auth);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

registerAuthHooks({
  getAccessToken: () => current?.accessToken ?? null,
  refresh: refreshTokens,
  onUnauthorized: () => {
    if (current) session.end("expired");
  },
});

export function useSession(): AdminSession | null {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}

export async function logout(): Promise<void> {
  const s = current;
  if (s) {
    try {
      await authApi.logout({ refreshToken: s.refreshToken });
    } catch {
      // La sesión local se cierra aunque el servidor no responda.
    }
  }
  session.end("logout");
}
