// Valores del backend simulado (solo VITE_API_MOCK=true). El usuario de prueba se configura en
// .env (VITE_MOCK_ADMIN_EMAIL, VITE_MOCK_ADMIN_PASSWORD; ver .env.example) y no queda escrito en
// el código: los builds de qa/prod no definen esas variables y no lo incluyen. Solo funciona
// dentro del navegador, contra los datos de src/api/mock/server.ts.

const email = (import.meta.env.VITE_MOCK_ADMIN_EMAIL ?? "").trim();
const password = import.meta.env.VITE_MOCK_ADMIN_PASSWORD ?? "";

export const MOCK_ADMIN = {
  /** false si faltan las variables: el login simulado rechaza cualquier credencial. */
  configured: email !== "" && password !== "",
  email,
  password,
  summary: {
    id: "3d9a1c2e-5b7f-4e8a-9c1d-2f3e4a5b6c7d",
    email,
    role: "ADMINISTRATOR" as const,
  },
};

/** Firma que la pasarela simulada envía en `X-Event-Checksum`. */
export const MOCK_WEBHOOK_SIGNATURE = "mock-sandbox-signature";
