import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { sleep } from "../../api/client";
import { reservationsApi } from "../../api/reservations";
import type { Reservation } from "../../api/types";
import { BookingSteps } from "../../components/BookingSteps";
import { ReservationCodeBlock } from "../../components/ReservationCodeBlock";
import { ReservationSummary } from "../../components/ReservationSummary";
import { Alert, Button, ErrorState, PageHeader, Spinner } from "../../components/ui";
import { courtNameOf, useCourts } from "../../hooks/useCourts";
import { bookingFromReservation, clearBooking, saveBooking } from "../../lib/booking";
import { isApiError } from "../../lib/errors";
import { normalizeCode, RESERVATION_CODE_PATTERN } from "../../lib/validation";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60_000;

/**
 * /booking/confirmation/:code — destino de la redirección de Wompi.
 * La confirmación es asíncrona (PaymentApproved por RabbitMQ), así que se consulta
 * la reserva hasta que deja de estar PENDING.
 */
export function ConfirmationPage() {
  const { code: rawCode = "" } = useParams();
  const code = normalizeCode(rawCode);
  const navigate = useNavigate();
  const courts = useCourts();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    setTimedOut(false);
    setError(null);

    void (async () => {
      while (!cancelled) {
        try {
          const r = await reservationsApi.getByCode(code);
          if (cancelled) return;
          setReservation(r);
          if (r.status === "REJECTED") {
            clearBooking();
            navigate(
              `/booking/failed?${new URLSearchParams({ reason: "payment", code: r.reservationCode, courtId: r.courtId, date: r.reservationDate })}`,
              { replace: true },
            );
            return;
          }
          if (r.status !== "PENDING") {
            if (r.status === "CONFIRMED") clearBooking();
            return;
          }
        } catch (err) {
          if (!cancelled) setError(err);
          return;
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setTimedOut(true);
          return;
        }
        await sleep(POLL_INTERVAL_MS);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, run, navigate]);

  const validCode = RESERVATION_CODE_PATTERN.test(code);
  const courtName = reservation ? courtNameOf(courts.data, reservation.courtId) : "";

  if (error) {
    return isApiError(error, 404) ? (
      <Alert tone="warning" title="No encontramos una reserva con ese código">
        <Link to="/reservations/lookup">Consultar otra reserva</Link>
      </Alert>
    ) : (
      <ErrorState error={error} onRetry={() => setRun((n) => n + 1)} />
    );
  }

  function retryPayment() {
    if (!reservation) return;
    saveBooking(bookingFromReservation(reservation, courtName));
    navigate("/booking/payment");
  }

  const status = reservation?.status;

  return (
    <>
      <BookingSteps current={4} />
      {status === "CONFIRMED" ? (
        <PageHeader title="¡Reserva confirmada!" subtitle="Tu pago fue aprobado. Te esperamos en la cancha." />
      ) : status === "CANCELLED" ? (
        <PageHeader title="Reserva cancelada" />
      ) : (
        <PageHeader title="Confirmando tu pago…" subtitle="Esto suele tardar unos segundos." />
      )}

      <div className="two-col">
        <div className="card card-body stack">
          {reservation ? (
            <ReservationSummary
              courtName={courtName}
              date={reservation.reservationDate}
              startTime={reservation.startTime}
              endTime={reservation.endTime}
              amount={reservation.amount}
            />
          ) : (
            <Spinner label="Consultando el estado de tu reserva…" />
          )}

          {status === "PENDING" && !timedOut && <Spinner label="Esperando la respuesta de Wompi…" />}
          {status === "PENDING" && timedOut && (
            <Alert tone="warning" title="Tu pago aún se está procesando">
              <p>
                Si no completaste el pago en Wompi, puedes intentarlo de nuevo. Si ya pagaste, consulta el estado más
                tarde con tu código.
              </p>
              <div className="actions">
                <Button onClick={() => setRun((n) => n + 1)}>Volver a consultar</Button>
                <Button variant="primary" onClick={retryPayment}>
                  Intentar pagar de nuevo
                </Button>
              </div>
            </Alert>
          )}
          {status === "CONFIRMED" && (
            <Alert tone="success" title="Todo listo">
              Presenta tu código al llegar. Puedes consultarlo o cancelarlo en{" "}
              <Link to={`/reservations/${code}`}>Consultar reserva</Link>.
            </Alert>
          )}
          {status === "CANCELLED" && (
            <Alert tone="info">
              Esta reserva fue cancelada. <Link to="/booking/availability">Hacer una nueva reserva</Link>
            </Alert>
          )}
        </div>
        {validCode && <ReservationCodeBlock code={code} />}
      </div>
    </>
  );
}
