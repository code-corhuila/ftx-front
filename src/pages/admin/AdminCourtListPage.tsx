import { Link } from "react-router-dom";
import { ErrorState, PageHeader, Skeleton, StatusBadge } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { loadCourts } from "../../hooks/useCourts";
import { formatMoney } from "../../lib/format";

/** /admin/courts — las cuatro canchas. No se crean ni se eliminan (BR-001, FR-032). */
export function AdminCourtListPage() {
  const courts = useAsync(() => loadCourts(true), []);

  return (
    <>
      <PageHeader
        title="Canchas"
        subtitle="Futbolix tiene exactamente cuatro canchas. Puedes cambiar su nombre, capacidad, precio y estado."
      />
      {courts.loading ? (
        <Skeleton count={4} height={48} />
      ) : courts.error ? (
        <ErrorState error={courts.error} onRetry={courts.reload} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Cancha</th>
                <th scope="col">Capacidad</th>
                <th scope="col">Precio por hora</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {courts.data?.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.capacity} jugadores</td>
                  <td>{formatMoney(c.hourlyPrice)}</td>
                  <td>
                    <StatusBadge kind="court" status={c.status} />
                  </td>
                  <td className="cell-actions">
                    <Link to={`/admin/courts/${c.id}/edit`} className="btn btn-ghost">
                      Editar
                    </Link>
                    <Link to={`/admin/schedules?courtId=${c.id}`} className="btn btn-ghost">
                      Horario
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
