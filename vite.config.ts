import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { SERVICE_ROUTES } from "./src/api/routing";

/**
 * Proxy de desarrollo, solo con FTX_DEV_PROXY=true (en .env o en el entorno) y solo en
 * `npm run dev`: mientras no exista el API Gateway, reparte /api/v1/** entre los servicios
 * locales con la misma tabla que usa el frontend (src/api/routing.ts). El navegador llama a su
 * propio origen (VITE_API_BASE_URL vacío), así que los servicios no necesitan CORS. Nunca entra en
 * un build: en qa y main ese trabajo es del gateway.
 */
function devProxy(): Plugin {
  return {
    name: "ftx-dev-proxy",
    config(config, { mode, command }) {
      if (command !== "serve") return;
      const env = loadEnv(mode, config.envDir || config.root || ".", "");
      if (env.FTX_DEV_PROXY !== "true") return;
      const targets: Partial<Record<string, string>> = {
        auth: env.FTX_CUSTOMERS_API_URL || "http://localhost:8081",
        courts: env.FTX_COURTS_API_URL || "http://localhost:8082",
        schedules: env.FTX_SCHEDULES_API_URL || "http://localhost:8085",
      };
      const proxy: Record<string, ProxyOptions> = {};
      for (const [domain, source] of SERVICE_ROUTES) {
        const target = targets[domain];
        // "^/auth(/|$)" -> "^/api/v1/auth(/|$)"; el orden de la tabla se conserva.
        if (target) proxy[source.replace("^", "^/api/v1")] = { target };
      }
      return { server: { proxy } };
    },
  };
}

// Puerto 5173: contenedor `web` en 10-devops/environments.md.
export default defineConfig({
  plugins: [react(), devProxy()],
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
  preview: { host: "0.0.0.0", port: 5173, strictPort: true },
});
