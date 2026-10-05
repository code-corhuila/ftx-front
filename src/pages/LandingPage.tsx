import { useState } from "react";
import { Link } from "react-router-dom";
import { CourtCard } from "../components/CourtCard";
import { ButtonLink, ErrorState, Skeleton } from "../components/ui";
import { useCourts } from "../hooks/useCourts";
import { formatShortDate, hhmm } from "../lib/format";
import { forgetReservation, getRecent } from "../lib/recent";

export function LandingPage() {
  const courts = useCourts();
  const [recent, setRecent] = useState(getRecent);

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <h1>Reserva tu cancha de fútbol en minutos</h1>
          <p className="lead">
            Cuatro canchas, pago en línea con Wompi y sin crear cuenta. Al terminar recibes un código para consultar o
            cancelar tu reserva.
          </p>
          <div className="actions">
            <ButtonLink to="/booking/availability" variant="primary">
              Reservar
            </ButtonLink>
            <ButtonLink to="/reservations/lookup">Consultar mi reserva</ButtonLink>
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="section">
          <h2>Tus reservas recientes</h2>
          <p className="muted small">Guardadas solo en este dispositivo.</p>
          <ul className="recent-list">
            {recent.map((r) => (
              <li key={r.code}>
                <Link to={`/reservations/${r.code}`} className="mono">
                  {r.code}
                </Link>
                <span className="muted">
                  {r.courtName} · {formatShortDate(r.date)} · {hhmm(r.startTime)}
                </span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    forgetReservation(r.code);
                    setRecent(getRecent());
                  }}
                >
                  Olvidar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <div className="row-between">
          <h2>Nuestras canchas</h2>
          <Link to="/courts">Ver todas</Link>
        </div>
        {courts.loading ? (
          <Skeleton count={4} height={260} grid />
        ) : courts.error ? (
          <ErrorState error={courts.error} onRetry={courts.reload} />
        ) : (
          <div className="grid grid-cards">
            {courts.data?.map((c) => <CourtCard key={c.id} court={c} />)}
          </div>
        )}
      </section>
    </>
  );
}
