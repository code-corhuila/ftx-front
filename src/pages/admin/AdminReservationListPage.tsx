import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { reservationsApi } from "../../api/reservations";
import type { Reservation, ReservationStatus } from "../../api/types";
import { CancelReservationDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { Button, EmptyState, ErrorState, PageHeader, SelectField, Skeleton, StatusBadge, TextField } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { courtNameOf, useCourts } from "../../hooks/useCourts";
import { errorMessage, isApiError } from "../../lib/errors";
import { formatMoney, formatShortDate, hhmm, isValidIsoDate, RESERVATION_STATUS_LABEL } from "../../lib/format";

const PAGE_SIZE = 20; // design-system.md → Data table: máximo 20 filas
const STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "CANCELLED", "REJECTED"];

/** /admin/reservations — historial, filtros y cancelación (FR-033 a FR-035). */
export function AdminReservationListPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const courts = useCourts();

  const statusParam = params.get("status") ?? "";
  const status = STATUSES.includes(statusParam as ReservationStatus) ? (statusParam as ReservationStatus) : undefined;
  const courtId = params.get("courtId") || undefined;
  const dateFrom = isValidIsoDate(params.get("dateFrom") ?? "") ? (params.get("dateFrom") as string) : undefined;
  const dateTo = isValidIsoDate(params.get("dateTo") ?? "") ? (params.get("dateTo") as string) : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const list = useAsync(
    () => reservationsApi.adminList({ page, limit: PAGE_SIZE, status, courtId, dateFrom, dateTo }),
    [page, status, courtId, dateFrom, dateTo],
  );

  const [target, setTarget] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next, { replace: true });
  }

  function goTo(p: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next);
  }

  async function onCancel(reason: string) {
    if (!target) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await reservationsApi.adminCancel(target.id, reason || undefined);
      toast(`Reserva ${target.reservationCode} cancelada`, "success");
      setTarget(null);
      list.reload();
    } catch (err) {
      setCancelError(errorMessage(err));
      if (isApiError(err, 409)) list.reload();
    } finally {
      setCancelling(false);
    }
  }

  const hasFilters = Boolean(status || courtId || dateFrom || dateTo);
  const meta = list.data?.meta;

  return (
    <>
      <PageHeader title="Reservas" subtitle="Historial completo, de la más reciente a la más antigua." />

      <div className="card card-body filters">
        <SelectField label="Estado" value={status ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">Todos</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {RESERVATION_STATUS_LABEL[s]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Cancha" value={courtId ?? ""} onChange={(e) => setFilter("courtId", e.target.value)}>
          <option value="">Todas</option>
          {courts.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Desde" type="date" value={dateFrom ?? ""} onChange={(e) => setFilter("dateFrom", e.target.value)} />
        <TextField label="Hasta" type="date" value={dateTo ?? ""} onChange={(e) => setFilter("dateTo", e.target.value)} />
        {hasFilters && (
          <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>
            Limpiar filtros
          </Button>
        )}
      </div>

      <section className="section">
        {list.loading && !list.data ? (
          <Skeleton count={6} height={44} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !list.data || list.data.data.length === 0 ? (
          <EmptyState
            title="No hay reservas con estos filtros"
            action={
              hasFilters ? (
                <Button variant="primary" onClick={() => setParams({}, { replace: true })}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="card table-wrap" aria-busy={list.loading}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Cancha</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Horario</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Valor</th>
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.data.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.reservationCode}</td>
                      <td>{courtNameOf(courts.data, r.courtId)}</td>
                      <td>{formatShortDate(r.reservationDate)}</td>
                      <td>
                        {hhmm(r.startTime)} – {hhmm(r.endTime)}
                      </td>
                      <td>
                        {r.customerName}
                        <div className="muted small">
                          {r.customerPhone} · {r.customerEmail}
                        </div>
                      </td>
                      <td>{formatMoney(r.amount)}</td>
                      <td>
                        <StatusBadge kind="reservation" status={r.status} />
                        {r.cancellationReason && <div className="muted small">{r.cancellationReason}</div>}
                      </td>
                      <td className="cell-actions">
                        {(r.status === "PENDING" || r.status === "CONFIRMED") && (
                          <Button
                            variant="danger"
                            onClick={() => {
                              setCancelError(null);
                              setTarget(r);
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && meta.totalPages > 1 && (
              <nav className="pagination" aria-label="Paginación">
                <Button disabled={page <= 1} onClick={() => goTo(page - 1)}>
                  Anterior
                </Button>
                <span>
                  Página {meta.page} de {meta.totalPages} · {meta.total} reservas
                </span>
                <Button disabled={page >= meta.totalPages} onClick={() => goTo(page + 1)}>
                  Siguiente
                </Button>
              </nav>
            )}
          </>
        )}
      </section>

      <CancelReservationDialog
        open={target !== null}
        code={target?.reservationCode ?? ""}
        loading={cancelling}
        error={cancelError}
        onConfirm={onCancel}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}
