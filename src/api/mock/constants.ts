// Valores del backend simulado (solo VITE_API_MOCK=true). No son credenciales reales:
// solo funcionan dentro del navegador, contra los datos de src/api/mock/server.ts.

export const MOCK_ADMIN = {
  email: "admin@futbolix.test",
  password: "Futbolix2026!",
  summary: {
    id: "3d9a1c2e-5b7f-4e8a-9c1d-2f3e4a5b6c7d",
    email: "admin@futbolix.test",
    role: "ADMINISTRATOR" as const,
  },
};

/** Firma que la pasarela simulada envía en `X-Event-Checksum`. */
export const MOCK_WEBHOOK_SIGNATURE = "mock-sandbox-signature";
