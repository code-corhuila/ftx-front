import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Las pruebas nunca leen el .env local: siempre usan el transporte HTTP real contra un
// gateway ficticio, salvo las que importan el backend simulado directamente.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      env: {
        VITE_API_MOCK: "false",
        VITE_API_BASE_URL: "http://gateway.test",
      },
    },
  }),
);
