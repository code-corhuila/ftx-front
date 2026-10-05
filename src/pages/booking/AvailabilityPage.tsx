import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { reservationsApi } from "../../api/reservations";
import type { IsoTime } from "../../api/types";
import { BookingSteps } from "../../components/BookingSteps";
import { SlotGrid } from "../../components/SlotGrid";
import { Alert, Button, ErrorState, PageHeader, SelectField, Skeleton, TextField } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { useCourts } from "../../hooks/useCourts";
import { EMPTY_CONTACT, getBooking, saveBooking } from "../../lib/booking";
import { COURT_STATUS_LABEL, formatDate, formatMoney, isValidIsoDate, todayIso } from "../../lib/format";

/** /booking/availability — elegir cancha y fecha, ver franjas libres (FR-002 a FR-005). */
export function AvailabilityPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const courts = useCourts();
  const today = todayIso();

  const previous = getBooking();
  const courtId = params.get("courtId") ?? previous?.courtId ?? "";
  const requestedDate = params.get("date") ?? previous?.date ?? today;
  // Fechas pasadas deshabilitadas: refleja el invariante INV-001 de Reservation.
  const date = isValidIsoDate(requestedDate) && requestedDate >= today ? requestedDate : today;

  const [selected, setSelected] = useState<IsoTime | undefined>();
  const availability = useAsync(
    () => (courtId ? reservationsApi.availability(courtId, date) : Promise.resolve(null)),
    [courtId, date],
  );

  useEffect(() => setSelected(undefined), [courtId, date]);

  function update(next: { courtId?: string; date?: string }) {
    const p = new URLSearchParams(params);
    if (next.courtId !== undefined) p.set("courtId", next.courtId);
    if (next.date !== undefined) p.set("date", next.date || today);
    setParams(p, { replace: true });
  }

  // Sin cancha elegida: se propone la primera disponible.
  useEffect(() => {
    if (!courtId && courts.data) {
      const first = courts.data.find((c) => c.status === "ACTIVE");
      if (first) update({ courtId: first.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtId, courts.data]);

  const court = courts.data?.find((c) => c.id === courtId);
  const data = availability.data;

  function onContinue() {
    if (!court || !selected || !data) return;
    // Un nuevo intento de reserva: se descartan la reserva y las claves de idempotencia anteriores.
    saveBooking({
      courtId: court.id,
      courtName: court.name,
      date,
      startTime: selected,
      hourlyPrice: data.hourlyPrice,
      slots: data.slots,
      hours: 1,
      customer: previous?.customer ?? EMPTY_CONTACT,
    });
    navigate("/booking/details");
  }

  return (
    <>
      <BookingSteps current={1} />
      <PageHeader title="Elige cancha, fecha y hora" />

      <div className="card card-body">
        <div className="form-row">
          {courts.loading ? (
            <Skeleton height={64} />
          ) : courts.error ? (
            <ErrorState error={courts.error} onRetry={courts.reload} />
          ) : (
            <SelectField label="Cancha" value={courtId} onChange={(e) => update({ courtId: e.target.value })}>
              {!courtId && <option value="">Selecciona una cancha</option>}
              {courts.data?.map((c) => (
                <option key={c.id} value={c.id} disabled={c.status !== "ACTIVE"}>
                  {c.name}
                  {c.status !== "ACTIVE" ? ` (${COURT_STATUS_LABEL[c.status]})` : ` · ${formatMoney(c.hourlyPrice)}/hora`}
                </option>
              ))}
            </SelectField>
          )}
          <TextField
            label="Fecha"
            type="date"
            min={today}
            value={date}
            onChange={(e) => update({ date: e.target.value })}
          />
        </div>
      </div>

      <section className="section" aria-live="polite">
        {!courtId ? null : availability.loading ? (
          <Skeleton count={1} height={160} />
        ) : availability.error ? (
          <ErrorState error={availability.error} onRetry={availability.reload} />
        ) : data && court && court.status !== "ACTIVE" ? (
          <Alert tone="warning" title={`${court.name} está ${COURT_STATUS_LABEL[court.status].toLowerCase()}`}>
            Elige otra cancha para reservar.
          </Alert>
        ) : data && data.slots.length === 0 ? (
          <Alert tone="info" title="La cancha está cerrada este día">
            Prueba otra fecha u otra cancha.
          </Alert>
        ) : data && !data.hasAvailability ? (
          <Alert tone="info" title="No hay franjas disponibles para esta fecha">
            Todas las franjas de {court?.name ?? "esta cancha"} están reservadas. Prueba otro día u otra cancha.
          </Alert>
        ) : data ? (
          <>
            <div className="row-between">
              <h2 className="capitalize">{formatDate(date)}</h2>
              <p className="muted">{formatMoney(data.hourlyPrice)} por hora</p>
            </div>
            <SlotGrid slots={data.slots} selected={selected} onSelect={setSelected} />
            <ul className="legend" aria-hidden="true">
              <li>
                <span className="legend-swatch slot-free" /> Libre
              </li>
              <li>
                <span className="legend-swatch slot-taken" /> Ocupada
              </li>
              <li>
                <span className="legend-swatch slot-selected" /> Seleccionada
              </li>
            </ul>
            <p className="muted small">
              La disponibilidad puede cambiar mientras completas tus datos: la franja queda apartada solo al crear la
              reserva.
            </p>
          </>
        ) : null}
      </section>

      <div className="actions actions-end">
        <Button variant="primary" disabled={!selected} onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </>
  );
}
