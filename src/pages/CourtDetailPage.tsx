import { Link, useParams } from "react-router-dom";
import { courtsApi } from "../api/courts";
import { PitchArt } from "../components/CourtCard";
import { Alert, ButtonLink, ErrorState, PageHeader, Skeleton, StatusBadge } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { isApiError } from "../lib/errors";
import { DAY_LABEL, formatMoney, hhmm, WEEK } from "../lib/format";

export function CourtDetailPage() {
  const { courtId = "" } = useParams();
  const court = useAsync(() => courtsApi.get(courtId), [courtId]);
  const schedules = useAsync(() => courtsApi.schedules(courtId), [courtId]);

  if (court.loading) return <Skeleton count={2} height={180} />;
  if (court.error || !court.data) {
    return isApiError(court.error, 404) ? (
      <Alert tone="warning" title="No encontramos esta cancha">
        <Link to="/courts">Ver las cuatro canchas</Link>
      </Alert>
    ) : (
      <ErrorState error={court.error} onRetry={court.reload} />
    );
  }

  const c = court.data;
  const active = c.status === "ACTIVE";

  return (
    <>
      <p className="breadcrumb">
        <Link to="/courts">Canchas</Link> / {c.name}
      </p>
      <PageHeader title={c.name} actions={<StatusBadge kind="court" status={c.status} />} />
      <div className="two-col">
        <div className="card">
          <PitchArt label={c.name} />
          <div className="card-body">
            <dl className="summary">
              <div>
                <dt>Deporte</dt>
                <dd>Fútbol</dd>
              </div>
              <div>
                <dt>Capacidad</dt>
                <dd>Hasta {c.capacity} jugadores</dd>
              </div>
              <div>
                <dt>Precio por hora</dt>
                <dd>{formatMoney(c.hourlyPrice)}</dd>
              </div>
            </dl>
            {active ? (
              <ButtonLink to={`/booking/availability?courtId=${c.id}`} variant="primary">
                Reservar esta cancha
              </ButtonLink>
            ) : (
              <Alert tone="warning">Esta cancha no está disponible para reservas en este momento.</Alert>
            )}
          </div>
        </div>

        <section className="card card-body">
          <h2>Horario semanal</h2>
          {schedules.loading ? (
            <Skeleton count={7} height={28} />
          ) : schedules.error ? (
            <ErrorState error={schedules.error} onRetry={schedules.reload} />
          ) : (
            <table className="table table-compact">
              <tbody>
                {WEEK.map((day) => {
                  const s = schedules.data?.find((x) => x.dayOfWeek === day);
                  return (
                    <tr key={day}>
                      <th scope="row">{DAY_LABEL[day]}</th>
                      <td>{s ? `${hhmm(s.openingTime)} – ${hhmm(s.closingTime)}` : <span className="muted">Cerrado</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
