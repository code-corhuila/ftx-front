import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { reservationsApi } from "../../api/reservations";
import { CancelReservationDialog } from "../../components/ConfirmDialog";
import { ReservationCodeBlock } from "../../components/ReservationCodeBlock";
import { useToast } from "../../components/Toast";
import { Alert, Button, ErrorState, PageHeader, Skeleton, StatusBadge } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { courtNameOf, useCourts } from "../../hooks/useCourts";
import { bookingFromReservation, saveBooking } from "../../lib/booking";
import { errorMessage, isApiError } from "../../lib/errors";
import { CANCELLED_BY_LABEL, formatDate, formatDateTime, formatMoney, hhmm } from "../../lib/format";
import { rememberReservation } from "../../lib/recent";
import { normalizeCode, RESERVATION_CODE_PATTERN } from "../../lib/validation";

const notFound = () => new ApiError(404, { error: "NOT_FOUND", message: "Not found" });

/** /reservations/:code — detalle y cancelación por código (FR-012 a FR-016). */
export function ReservationDetailPage() {
  const { code: rawCode = "" } = useParams();
  const code = normalizeCode(rawCode);
  const navigate = useNavigate();
  const toast = useToast();
  const courts = useCourts();
  const query = useAsync(
    () => (RESERVATION_CODE_PATTERN.test(code) ? reservationsApi.getByCode(code) : Promise.reject(notFound())),
    [code],
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const r = query.data;
  const courtName = r ? courtNameOf(courts.data, r.courtId) : "";

  useEffect(() => {
    if (r && courts.data) rememberReservation(r, courtName);
  }, [r, courts.data, courtName]);

  if (query.loading && !r) return <Skeleton count={3} height={120} />;
  if (query.error || !r) {
    return isApiError(query.error, 404) ? (
      <div className="narrow">
        <Alert tone="warning" title="No encontramos una reserva con ese código">
          <p>Revisa que esté bien escrito e inténtalo de nuevo.</p>
          <Link to="/reservations/lookup">Consultar otra reserva</Link>
        </Alert>
      </div>
    ) : (
      <ErrorState error={query.error} onRetry={query.reload} />
    );
  }

  const reservation = r;
  const cancellable = reservation.status === "PENDING" || reservation.status === "CONFIRMED";

  async function onCancel(reason: string) {
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await reservationsApi.cancelByCode(reservation.reservationCode, reason || undefined);
      query.setData(updated);
      setCancelOpen(false);
      toast("Reserva cancelada", "success");
    } catch (err) {
      setCancelError(errorMessage(err));
      if (isApiError(err, 409)) query.reload();
    } finally {
      setCancelling(false);
    }
  }

  function payNow() {
    saveBooking(bookingFromReservation(reservation, courtName));
    navigate("/booking/payment");
  }

  return (
    <>
      <PageHeader title="Tu reserva" actions={<StatusBadge kind="reservation" status={reservation.status} />} />

      <div className="two-col">
        <div className="card card-body stack">
          {reservation.status === "PENDING" && (
            <Alert tone="warning" title="Pago pendiente">
              <p>La franja está apartada mientras se completa el pago.</p>
              <Button variant="primary" onClick={payNow}>
                Completar pago
              </Button>
            </Alert>
          )}
          {reservation.status === "CONFIRMED" && (
            <Alert tone="success" title="Reserva confirmada">
              Tu pago fue aprobado. Presenta este código al llegar.
            </Alert>
          )}
          {reservation.status === "REJECTED" && (
            <Alert tone="error" title="Pago rechazado">
              La reserva no se confirmó y la franja se liberó. <Link to="/booking/availability">Reservar de nuevo</Link>
            </Alert>
          )}

          <dl className="summary">
            <div>
              <dt>Cancha</dt>
              <dd>{courtName}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd className="capitalize">{formatDate(reservation.reservationDate)}</dd>
            </div>
            <div>
              <dt>Horario</dt>
              <dd>
                {hhmm(reservation.startTime)} – {hhmm(reservation.endTime)}
              </dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{formatMoney(reservation.amount)}</dd>
            </div>
            <div>
              <dt>A nombre de</dt>
              <dd>{reservation.customerName}</dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd>{reservation.customerPhone}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{reservation.customerEmail}</dd>
            </div>
            <div>
              <dt>Creada</dt>
              <dd>{formatDateTime(reservation.createdAt)}</dd>
            </div>
            {reservation.status === "CANCELLED" && reservation.cancelledAt && (
              <div>
                <dt>Cancelada</dt>
                <dd>
                  {formatDateTime(reservation.cancelledAt)}
                  {reservation.cancelledBy && ` · por ${CANCELLED_BY_LABEL[reservation.cancelledBy].toLowerCase()}`}
                </dd>
              </div>
            )}
            {reservation.cancellationReason && (
              <div>
                <dt>Motivo</dt>
                <dd>{reservation.cancellationReason}</dd>
              </div>
            )}
          </dl>

          {cancellable && (
            <div className="actions">
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                Cancelar reserva
              </Button>
            </div>
          )}
        </div>

        <ReservationCodeBlock code={reservation.reservationCode} />
      </div>

      <CancelReservationDialog
        open={cancelOpen}
        code={reservation.reservationCode}
        loading={cancelling}
        error={cancelError}
        onConfirm={onCancel}
        onCancel={() => {
          setCancelOpen(false);
          setCancelError(null);
        }}
      />
    </>
  );
}
