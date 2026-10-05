import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { reservationsApi } from "../../api/reservations";
import { Button, PageHeader, TextField } from "../../components/ui";
import { errorMessage, isApiError } from "../../lib/errors";
import { formatShortDate, hhmm } from "../../lib/format";
import { getRecent } from "../../lib/recent";
import { normalizeCode, RESERVATION_CODE_PATTERN } from "../../lib/validation";

// Mismo texto para un código mal escrito y para uno inexistente: nunca se confirma
// que un código existe (navigation-map.md → Reservation code enumeration).
const NOT_FOUND = "No encontramos una reserva con ese código. Revisa que esté bien escrito e inténtalo de nuevo.";

/** /reservations/lookup — el código es la única llave del cliente (FR-016). */
export function LookupPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const recent = getRecent();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeCode(code);
    if (!RESERVATION_CODE_PATTERN.test(normalized)) {
      setError(NOT_FOUND);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const r = await reservationsApi.getByCode(normalized);
      navigate(`/reservations/${r.reservationCode}`);
    } catch (err) {
      setError(isApiError(err, 404) ? NOT_FOUND : errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="narrow">
      <PageHeader title="Consultar mi reserva" subtitle="Escribe el código que recibiste al reservar." />
      <form className="card card-body stack" onSubmit={onSubmit} noValidate>
        <TextField
          label="Código de reserva"
          className="field-code"
          value={code}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          placeholder="FTX7Q2K9M4"
          error={error}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <Button type="submit" variant="primary" loading={loading}>
          Consultar
        </Button>
      </form>

      {recent.length > 0 && (
        <section className="section">
          <h2>Tus reservas recientes</h2>
          <ul className="recent-list">
            {recent.map((r) => (
              <li key={r.code}>
                <Link to={`/reservations/${r.code}`} className="mono">
                  {r.code}
                </Link>
                <span className="muted">
                  {r.courtName} · {formatShortDate(r.date)} · {hhmm(r.startTime)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
