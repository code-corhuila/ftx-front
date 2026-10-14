import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { session } from "../auth/session";
import { RequireAdmin } from "./RequireAdmin";

function LoginProbe() {
  const state = useLocation().state as { from: string; expired: boolean };
  return <p>login from={state.from} expired={String(state.expired)}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/login" element={<LoginProbe />} />
        <Route
          path="/admin/*"
          element={
            <RequireAdmin>
              <p>panel</p>
            </RequireAdmin>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => session.end("logout"));

describe("RequireAdmin", () => {
  it("sin sesión redirige al login recordando la ruta pedida", () => {
    renderAt("/admin/reservations?status=PENDING");

    expect(screen.getByText("login from=/admin/reservations?status=PENDING expired=false")).toBeTruthy();
    expect(screen.queryByText("panel")).toBeNull();
  });

  it("avisa en el login cuando la sesión expiró", () => {
    session.end("expired");
    renderAt("/admin");

    expect(screen.getByText("login from=/admin expired=true")).toBeTruthy();
  });

  it("con sesión muestra el contenido protegido", () => {
    session.start({
      accessToken: "a",
      refreshToken: "r",
      expiresIn: 3600,
      user: { id: "3d9a1c2e-5b7f-4e8a-9c1d-2f3e4a5b6c7d", email: "admin@futbolix.test", role: "ADMINISTRATOR" },
    });
    renderAt("/admin");

    expect(screen.getByText("panel")).toBeTruthy();
  });
});
