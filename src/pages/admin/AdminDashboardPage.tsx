import { Link } from "react-router-dom";
import { reservationsApi } from "../../api/reservations";
import type { ReservationStatus } from "../../api/types";
import { EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { courtNameOf, loadCourts } from "../../hooks/useCourts";
import { formatDate, formatMoney, hhmm, todayIso } from "../../lib/format";

/** /admin — resumen del día. */
export function AdminDashboardPage() {
  const today = todayIso();
  const reservations = useAsync(
    () => reservationsApi.adminList({ dateFrom: today, dateTo: today, page: 1, limit: 100 }),
    [today],
  );
  const courts = useAsync(() => loadCourts(true), []);

  const rows = [...(reservations.data?.data ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const count = (status: ReservationStatus) => rows.filter((r) => r.status === status).length;
  const confirmedIncome = rows.filter((r) => r.status === "CONFIRMED").reduce((sum, r) => sum + r.amount.amount, 0);

  return (
    <>
      <PageHeader title="Resumen de hoy" subtitle={<span className="capitalize">{formatDate(today)}</span>} />

      {reservations.loading ? (
        <Skeleton count={4} height={90} grid />
      ) : reservations.error ? (
        <ErrorState error={reservations.error} onRetry={reservations.reload} />
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Reservas de hoy</span>
              <span className="stat-value">{rows.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Confirmadas</span>
              <span className="stat-value">{count("CONFIRMED")}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Pendientes de pago</span>
              <span className="stat-value">{count("PENDING")}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Ingresos confirmados</span>
              <span className="stat-value">{formatMoney(confirmedIncome)}</span>
            </div>
          </div>

          <section className="section card card-body">
            <div className="row-between">
              <h2>Reservas de hoy</h2>
              <Link to={`/admin/reservations?dateFrom=${today}&dateTo=${today}`}>Gestionar</Link>
            </div>
            {rows.length === 0 ? (
              <EmptyState title="No hay reservas para hoy" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Hora</th>
                      <th scope="col">Cancha</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Valor</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {hhmm(r.startTime)} – {hhmm(r.endTime)}
                        </td>
                        <td>{courtNameOf(courts.data, r.courtId)}</td>
                        <td>{r.customerName}</td>
                        <td>{formatMoney(r.amount)}</td>
                        <td>
                          <StatusBadge kind="reservation" status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <section className="section card card-body">
        <div className="row-between">
          <h2>Estado de las canchas</h2>
          <Link to="/admin/courts">Gestionar</Link>
        </div>
        {courts.loading ? (
          <Skeleton count={4} height={32} />
        ) : courts.error ? (
          <ErrorState error={courts.error} onRetry={courts.reload} />
        ) : (
          <ul className="court-status-list">
            {courts.data?.map((c) => (
              <li key={c.id}>
                <span>{c.name}</span>
                <StatusBadge kind="court" status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
