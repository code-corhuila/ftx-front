import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { reservationsApi } from "../../api/reservations";
import { BookingSteps } from "../../components/BookingSteps";
import { Alert, Button, PageHeader, TextField } from "../../components/ui";
import { canBook, getBooking, maxConsecutiveHours, saveBooking, type BookingState } from "../../lib/booking";
import { MAX_BOOKING_HOURS } from "../../lib/courtRules";
import { errorMessage, fieldErrors, generalDetails, isApiError } from "../../lib/errors";
import { addHours, formatDate, formatMoney, hhmm } from "../../lib/format";
import { rememberReservation } from "../../lib/recent";
import { uuid } from "../../lib/uuid";
import { normalizePhone, validateContact, type ContactErrors, type ContactInput } from "../../lib/validation";

/** /booking/details — duración, monto y datos de contacto. Sin franja elegida no tiene sentido. */
export function BookingDetailsPage() {
  const booking = getBooking();
  if (!booking?.courtId || !booking.date || !booking.startTime) return <Navigate to="/booking/availability" replace />;
  if (booking.reservation) return <Navigate to="/booking/payment" replace />;
  return <BookingDetailsForm initial={booking} />;
}

function BookingDetailsForm({ initial }: { initial: BookingState }) {
  const navigate = useNavigate();
  const [b, setB] = useState(initial);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<unknown>(null);

  const persist = (next: BookingState) => {
    saveBooking(next);
    setB(next);
  };

  const maxHours = Math.max(1, maxConsecutiveHours(b.slots, b.startTime, MAX_BOOKING_HOURS));
  const hours = Math.min(b.hours, maxHours);
  const endTime = addHours(b.startTime, hours);
  const previewAmount = b.hourlyPrice.amount * hours;
  const availabilityLink = `/booking/availability?${new URLSearchParams({ courtId: b.courtId, date: b.date })}`;

  function setField(field: keyof ContactInput, value: string) {
    persist({ ...b, customer: { ...b.customer, [field]: value } });
    if (errors[field]) setErrors((e) => ({ ...e, [field]: validateContact({ ...b.customer, [field]: value })[field] }));
  }

  function onBlur(field: keyof ContactInput) {
    setErrors((e) => ({ ...e, [field]: validateContact(b.customer)[field] }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // "Continuar al pago" se deshabilita al primer clic

    const contact = { ...b.customer, customerPhone: normalizePhone(b.customer.customerPhone) };
    const validation = validateContact(contact);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    setApiError(null);
    // Misma clave en los reintentos de esta intención: nunca se crean dos reservas.
    const withKey: BookingState = { ...b, hours, customer: contact, reservationKey: b.reservationKey ?? uuid() };
    persist(withKey);

    try {
      const reservation = await reservationsApi.create(
        {
          courtId: b.courtId,
          reservationDate: b.date,
          startTime: b.startTime,
          endTime,
          customerName: contact.customerName.trim(),
          customerEmail: contact.customerEmail.trim(),
          customerPhone: contact.customerPhone,
        },
        withKey.reservationKey as string,
      );
      persist({ ...withKey, reservation });
      rememberReservation(reservation, b.courtName);
      navigate("/booking/payment", { replace: true });
    } catch (err) {
      if (isApiError(err, 409)) {
        // La franja se ocupó mientras tanto: pantalla completa, no un toast (design-system.md).
        navigate(`/booking/failed?${new URLSearchParams({ reason: "slot", courtId: b.courtId, date: b.date })}`, {
          replace: true,
        });
        return;
      }
      // Un 4xx rechazó la petición: corregir los datos es una nueva intención con otra clave.
      if (isApiError(err) && err.status < 500) persist({ ...withKey, reservationKey: undefined });
      setApiError(err);
      setErrors((current) => ({ ...current, ...fieldErrors(err) }));
      setSubmitting(false);
    }
  }

  const apiFieldErrors = fieldErrors(apiError);
  const ruleMessages = Object.entries(apiFieldErrors)
    .filter(([field]) => !["customerName", "customerPhone", "customerEmail"].includes(field))
    .map(([, message]) => message);

  return (
    <>
      <BookingSteps current={2} />
      <PageHeader title="Tus datos" subtitle="No necesitas crear una cuenta. Usaremos estos datos solo para esta reserva." />

      <form className="two-col" onSubmit={onSubmit} noValidate>
        <div className="card card-body stack">
          <h2>Contacto</h2>
          <TextField
            label="Nombre completo"
            autoComplete="name"
            maxLength={120}
            value={b.customer.customerName}
            error={errors.customerName}
            onChange={(e) => setField("customerName", e.target.value)}
            onBlur={() => onBlur("customerName")}
          />
          <TextField
            label="Teléfono"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+573001234567"
            value={b.customer.customerPhone}
            error={errors.customerPhone}
            onChange={(e) => setField("customerPhone", e.target.value)}
            onBlur={() => onBlur("customerPhone")}
          />
          <TextField
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            maxLength={255}
            value={b.customer.customerEmail}
            error={errors.customerEmail}
            onChange={(e) => setField("customerEmail", e.target.value)}
            onBlur={() => onBlur("customerEmail")}
          />
        </div>

        <div className="card card-body stack">
          <h2>Tu reserva</h2>
          <dl className="summary">
            <div>
              <dt>Cancha</dt>
              <dd>{b.courtName}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd className="capitalize">{formatDate(b.date)}</dd>
            </div>
          </dl>

          <fieldset className="radio-group">
            <legend>Duración</legend>
            {Array.from({ length: MAX_BOOKING_HOURS }, (_, i) => i + 1).map((h) => {
              const possible = canBook(b.slots, b.startTime, h) || (b.slots.length === 0 && h === 1);
              return (
                <label key={h} className={`radio ${possible ? "" : "radio-disabled"}`}>
                  <input
                    type="radio"
                    name="hours"
                    value={h}
                    checked={hours === h}
                    disabled={!possible || submitting}
                    onChange={() => persist({ ...b, hours: h })}
                  />
                  {h} {h === 1 ? "hora" : "horas"}{" "}
                  <span className="muted">
                    ({hhmm(b.startTime)} – {hhmm(addHours(b.startTime, h))})
                  </span>
                  {!possible && <span className="muted small"> · no disponible</span>}
                </label>
              );
            })}
          </fieldset>

          <div className="amount" aria-live="polite">
            <span>Total a pagar</span>
            <strong>{formatMoney(previewAmount)}</strong>
          </div>
          <p className="muted small">
            {formatMoney(b.hourlyPrice)} × {hours} {hours === 1 ? "hora" : "horas"}. El valor definitivo lo calcula el
            sistema al crear la reserva.
          </p>

          {apiError !== null && (
            <Alert tone="error" title={errorMessage(apiError)}>
              {[...ruleMessages, ...generalDetails(apiError)].length > 0 && (
                <ul>
                  {[...ruleMessages, ...generalDetails(apiError)].map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}

          <div className="actions">
            <Link to={availabilityLink} className="btn btn-secondary">
              Cambiar franja
            </Link>
            <Button type="submit" variant="primary" loading={submitting}>
              Continuar al pago
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
