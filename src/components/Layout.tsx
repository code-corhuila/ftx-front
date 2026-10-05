import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout, useSession } from "../auth/session";
import { config } from "../config";
import { Button } from "./ui";

function MockBanner() {
  function reset() {
    void import("../api/mock/server").then((m) => {
      m.resetMockDb();
      window.location.reload();
    });
  }
  return (
    <div className="mock-banner no-print" role="note">
      <span>
        <strong>Modo simulado:</strong> los datos viven en este navegador y no hay conexión con los microservicios.
      </span>
      <button type="button" className="link-btn" onClick={reset}>
        Reiniciar datos
      </button>
    </div>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand ${inverse ? "brand-inverse" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        FX
      </span>
      Futbolix
    </span>
  );
}

/** Rutas públicas: el cliente nunca inicia sesión (navigation-map.md). */
export function PublicLayout() {
  const s = useSession();
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <header className="site-header no-print">
        <div className="container header-inner">
          <Link to="/" aria-label="Futbolix, inicio">
            <Brand inverse />
          </Link>
          <nav aria-label="Principal" className="main-nav">
            <NavLink to="/courts">Canchas</NavLink>
            <NavLink to="/booking/availability">Reservar</NavLink>
            <NavLink to="/reservations/lookup">Consultar reserva</NavLink>
            <NavLink to={s ? "/admin" : "/admin/login"} className="nav-admin">
              Administración
            </NavLink>
          </nav>
        </div>
      </header>
      {config.mock && <MockBanner />}
      <main id="main" className="container page">
        <Outlet />
      </main>
      <footer className="site-footer no-print">
        <div className="container">
          <p>Futbolix · Cuatro canchas de fútbol · Pagos procesados por Wompi (Sandbox)</p>
        </div>
      </footer>
    </div>
  );
}

/** Panel de administración (rol ADMINISTRATOR). */
export function AdminLayout() {
  const s = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    await logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="admin-shell">
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <aside className="sidebar no-print">
        <Link to="/admin" aria-label="Panel de administración">
          <Brand inverse />
        </Link>
        <nav aria-label="Administración" className="sidebar-nav">
          <NavLink end to="/admin">
            Resumen
          </NavLink>
          <NavLink to="/admin/courts">Canchas</NavLink>
          <NavLink to="/admin/schedules">Horarios</NavLink>
          <NavLink to="/admin/reservations">Reservas</NavLink>
        </nav>
        <div className="sidebar-footer">
          <p className="small">{s?.user.email}</p>
          <Button variant="ghost" className="btn-inverse" loading={busy} onClick={onLogout}>
            Cerrar sesión
          </Button>
          <Link to="/" className="small">
            Ver sitio público
          </Link>
        </div>
      </aside>
      <div className="admin-main">
        {config.mock && <MockBanner />}
        <main id="main" className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
