import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError, NetworkError, sleep } from "../../api/client";
import { paymentsApi } from "../../api/payments";
import { reservationsApi } from "../../api/reservations";
import type { Reservation } from "../../api/types";
import { BookingSteps } from "../../components/BookingSteps";
import { CancelReservationDialog } from "../../components/ConfirmDialog";
import { ReservationCodeBlock } from "../../components/ReservationCodeBlock";
import { ReservationSummary } from "../../components/ReservationSummary";
import { Alert, Button, PageHeader, Spinner } from "../../components/ui";
import { clearBooking, getBooking, updateBooking } from "../../lib/booking";
import { errorMessage, isApiError } from "../../lib/errors";
import { uuid } from "../../lib/uuid";

const MAX_ATTEMPTS = 6;

/** /booking/payment — inicia el checkout de Wompi y redirige (HU-PAY-003). */
export function PaymentRedirectPage() {
  const booking = getBooking();
  if (!booking?.reservation) return <Navigate to="/booking/availability" replace />;
  return <PaymentRedirect reservation={booking.reservation} courtName={booking.courtName} />;
}

type Phase = "starting" | "waiting" | "redirecting" | "error";

/**
 * La pasarela no está disponible: 503 de payment-service (Wompi no respondió o el circuito está
 * abierto, payment-service.yaml) o el gateway no respondió a tiempo. El pago sigue PENDING.
 */
function isPaymentUnavailable(err: unknown): boolean {
  return (err instanceof ApiError && err.status === 503) || err instanceof NetworkError;
}

function isSafeRedirect(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function PaymentRedirect({ reservation, courtName }: { reservation: Reservation; courtName: string }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<unknown>(null);
  const [run, setRun] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const code = reservation.reservationCode;

  /** Compensación iniciada por el cliente: cancelar la reserva PENDING libera la franja. */
  async function cancelReservation(reason: string) {
    setCancelling(true);
    setCancelError(null);
    try {
      await reservationsApi.cancelByCode(code, reason || "Pago no disponible");
      clearBooking();
      navigate(`/reservations/${code}`, { replace: true });
    } catch (err) {
      setCancelError(errorMessage(err));
      setCancelling(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setPhase("starting");
    setError(null);

    void (async () => {
      const key = getBooking()?.checkoutKey ?? uuid();
      updateBooking({ checkoutKey: key });

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const checkout = await paymentsApi.startCheckout(code, key);
          if (cancelled) return;
          if (!isSafeRedirect(checkout.checkoutUrl)) throw new Error("URL de pago no válida");
          setPhase("redirecting");
          window.location.assign(checkout.checkoutUrl);
          return;
        } catch (err) {
          if (cancelled) return;
          // El pago se registra al consumir ReservationCreated: un 404 inicial es transitorio.
          if (isApiError(err, 404) && attempt < MAX_ATTEMPTS) {
            setPhase("waiting");
            await sleep(1000 * attempt);
            if (cancelled) return;
            continue;
          }
          if (isApiError(err, 409)) {
            // El pago ya no está pendiente: se muestra el estado real de la reserva.
            navigate(`/reservations/${code}`, { replace: true });
            return;
          }
          setError(err);
          setPhase("error");
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, run, navigate]);

  const unavailable = isPaymentUnavailable(error);
  const gatewayDown = error instanceof ApiError && error.status >= 500;

  return (
    <>
      <BookingSteps current={3} />
      <PageHeader title="Pago" subtitle="Pagarás en la pasarela de Wompi. Futbolix nunca ve los datos de tu tarjeta." />

      <div className="two-col">
        <div className="card card-body stack">
          <ReservationSummary
            courtName={courtName}
            date={reservation.reservationDate}
            startTime={reservation.startTime}
            endTime={reservation.endTime}
            amount={reservation.amount}
          />
          {phase === "starting" && <Spinner label="Preparando el pago con Wompi…" />}
          {phase === "waiting" && <Spinner label="Estamos registrando tu pago. Un momento…" />}
          {phase === "redirecting" && <Spinner label="Te estamos llevando a Wompi…" />}
          {phase === "error" && unavailable && (
            <Alert tone="warning" title="Wompi no está disponible en este momento">
              <p>
                Tu reserva <span className="mono">{code}</span> sigue pendiente y no se hizo ningún cobro. Puedes
                reintentar el pago en unos minutos o cancelar la reserva para liberar la franja.
              </p>
              <div className="actions">
                <Button variant="primary" onClick={() => setRun((n) => n + 1)}>
                  Reintentar pago
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setCancelError(null);
                    setCancelOpen(true);
                  }}
                >
                  Cancelar reserva
                </Button>
                <Link to={`/reservations/${code}`} className="btn btn-ghost">
                  Ver mi reserva
                </Link>
              </div>
            </Alert>
          )}
          {phase === "error" && !unavailable && (
            <Alert
              tone="error"
              title={gatewayDown ? "No pudimos contactar la pasarela. Tu reserva sigue pendiente." : errorMessage(error)}
            >
              <p>Tu código está a la derecha: con él puedes volver a intentar el pago más tarde.</p>
              <div className="actions">
                <Button variant="primary" onClick={() => setRun((n) => n + 1)}>
                  Reintentar
                </Button>
                <Link to={`/reservations/${code}`} className="btn btn-ghost">
                  Ver mi reserva
                </Link>
              </div>
            </Alert>
          )}
        </div>
        <ReservationCodeBlock code={code} />
      </div>
      <CancelReservationDialog
        open={cancelOpen}
        code={code}
        loading={cancelling}
        error={cancelError}
        onConfirm={cancelReservation}
        onCancel={() => setCancelOpen(false)}
      />
    </>
  );
}
