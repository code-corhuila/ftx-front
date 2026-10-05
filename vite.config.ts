import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Puerto 5173: contenedor `web` en 10-devops/environments.md.
export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
  preview: { host: "0.0.0.0", port: 5173, strictPort: true },
});
