import type { Court } from "../api/types";
import { formatMoney } from "../lib/format";
import { ButtonLink, StatusBadge } from "./ui";

export function PitchArt({ label }: { label: string }) {
  return (
    <div className="pitch" aria-hidden="true">
      <span className="pitch-line pitch-mid" />
      <span className="pitch-circle" />
      <span className="pitch-label">{label}</span>
    </div>
  );
}

export function CourtCard({ court }: { court: Court }) {
  const active = court.status === "ACTIVE";
  return (
    <article className="card court-card">
      <PitchArt label={court.name} />
      <div className="card-body">
        <div className="row-between">
          <h3>{court.name}</h3>
          <StatusBadge kind="court" status={court.status} />
        </div>
        <p className="muted">Fútbol · hasta {court.capacity} jugadores</p>
        <p className="price">
          {formatMoney(court.hourlyPrice)} <span className="muted">/ hora</span>
        </p>
        <div className="card-actions">
          <ButtonLink to={`/courts/${court.id}`} variant="ghost">
            Ver detalle
          </ButtonLink>
          {active ? (
            <ButtonLink to={`/booking/availability?courtId=${court.id}`}>Reservar</ButtonLink>
          ) : (
            <span className="muted small">No disponible para reservas</span>
          )}
        </div>
      </div>
    </article>
  );
}
