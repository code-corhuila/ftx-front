import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ButtonLink, PageHeader } from "../../components/ui";
import { clearBooking } from "../../lib/booking";
import { formatDate, isValidIsoDate } from "../../lib/format";

/**
 * /booking/failed — franja tomada mientras tanto (409) o pago rechazado.
 * Pantalla completa que conserva cancha y fecha (design-system.md → Error handling).
 */
export function BookingFailedPage() {
  const [params] = useSearchParams();
  const reason = params.get("reason") === "payment" ? "payment" : "slot";
  const courtId = params.get("courtId") ?? "";
  const date = params.get("date") ?? "";
  const code = params.get("code");

  useEffect(() => {
    if (reason === "payment") clearBooking();
  }, [reason]);

  const back = new URLSearchParams();
  if (courtId) back.set("courtId", courtId);
  if (date) back.set("date", date);
  const backLink = `/booking/availability${back.toString() ? `?${back}` : ""}`;
  const dateText = isValidIsoDate(date) ? formatDate(date) : null;

  return (
    <div className="failed-page">
      <div className="failed-icon" aria-hidden="true">
        {reason === "slot" ? "⏱" : "✕"}
      </div>
      {reason === "slot" ? (
        <>
          <PageHeader title="Esa franja acaba de ser reservada" />
          <p className="lead">
            Otra persona reservó la misma cancha y horario mientras completabas tus datos. No se hizo ningún cobro.
          </p>
          {dateText && <p className="muted capitalize">Conservamos la fecha: {dateText}.</p>}
          <ButtonLink to={backLink} variant="primary">
            Elegir otra franja
          </ButtonLink>
        </>
      ) : (
        <>
          <PageHeader title="Tu pago fue rechazado" />
          <p className="lead">
            Wompi no aprobó el pago, así que la reserva {code && <span className="mono">{code}</span>} no quedó
            confirmada y la franja se liberó. No se hizo ningún cobro.
          </p>
          <div className="actions actions-center">
            <ButtonLink to={backLink} variant="primary">
              Intentar de nuevo
            </ButtonLink>
            <ButtonLink to="/">Volver al inicio</ButtonLink>
          </div>
        </>
      )}
    </div>
  );
}
