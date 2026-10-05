// user-service — 07-api/contracts/openapi/auth-service.yaml (título: "Futbolix User Service API")
import { apiRequest } from "./client";
import type { AuthResponse, LoginRequest, LogoutRequest } from "./types";

export const authApi = {
  /** POST /auth/login — único inicio de sesión del sistema (administrador). */
  login(body: LoginRequest): Promise<AuthResponse> {
    return apiRequest<AuthResponse>({ method: "POST", path: "/auth/login", body });
  },

  /** POST /auth/refresh — rota el refresh token. */
  refresh(refreshToken: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>({
      method: "POST",
      path: "/auth/refresh",
      body: { refreshToken },
      skipAuthRefresh: true,
    });
  },

  /** POST /auth/logout — revoca el refresh token. */
  logout(body: LogoutRequest): Promise<void> {
    return apiRequest<void>({ method: "POST", path: "/auth/logout", body, auth: true, skipAuthRefresh: true });
  },
};
