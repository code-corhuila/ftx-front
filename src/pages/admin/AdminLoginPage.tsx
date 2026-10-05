import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import { MOCK_ADMIN } from "../../api/mock/constants";
import { session, useSession } from "../../auth/session";
import { Alert, Button, PageHeader, TextField } from "../../components/ui";
import { config } from "../../config";
import { errorMessage, isApiError } from "../../lib/errors";

/** /admin/login — el único inicio de sesión del sistema (FR-026, FR-027). */
export function AdminLoginPage() {
  const current = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { from?: string; expired?: boolean } | null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const target = state?.from && state.from.startsWith("/admin") ? state.from : "/admin";
  if (current) return <Navigate to={target} replace />;

  const expired = Boolean(state?.expired) || session.wasExpired();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 8) {
      setError("Escribe tu correo y tu contraseña (mínimo 8 caracteres).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      session.start(await authApi.login({ email: email.trim(), password }));
      navigate(target, { replace: true });
    } catch (err) {
      // Mensaje genérico: nunca revela si falló el correo o la contraseña.
      setError(
        isApiError(err, 401)
          ? "Correo o contraseña incorrectos."
          : isApiError(err, 400)
            ? "Revisa el correo y la contraseña (mínimo 8 caracteres)."
            : errorMessage(err),
      );
      setPassword("");
      setLoading(false);
    }
  }

  return (
    <div className="narrow">
      <PageHeader title="Administración" subtitle="Acceso solo para administradores de Futbolix." />
      {expired && <Alert tone="warning">Tu sesión expiró. Inicia sesión de nuevo.</Alert>}
      <form className="card card-body stack" onSubmit={onSubmit} noValidate>
        <TextField
          label="Correo"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" variant="primary" loading={loading}>
          Iniciar sesión
        </Button>
      </form>
      {config.mock && (
        <p className="muted small mock-hint">
          Modo simulado — usuario de prueba: <span className="mono">{MOCK_ADMIN.email}</span> · contraseña:{" "}
          <span className="mono">{MOCK_ADMIN.password}</span>
        </p>
      )}
    </div>
  );
}
