import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Sin `globals: true`, Testing Library no desmonta solo entre pruebas.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
