import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { courtsApi } from "../../api/courts";
import type { DayOfWeek, Schedule } from "../../api/types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { Button, ErrorState, PageHeader, SelectField, Skeleton } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { useCourts } from "../../hooks/useCourts";
import { errorMessage } from "../../lib/errors";
import { DAY_LABEL, hhmm, timeToMinutes, toApiTime, WEEK } from "../../lib/format";

/** /admin/schedules — horario de apertura por cancha y día (FR-029). */
export function AdminSchedulePage() {
  const [params, setParams] = useSearchParams();
  const courts = useCourts();
  const courtId = params.get("courtId") ?? "";
  const schedules = useAsync(
    () => (courtId ? courtsApi.schedules(courtId) : Promise.resolve([] as Schedule[])),
    [courtId],
  );

  useEffect(() => {
    if (!courtId && courts.data?.length) setParams({ courtId: courts.data[0].id }, { replace: true });
  }, [courtId, courts.data, setParams]);

  function replace(day: DayOfWeek, schedule: Schedule | null) {
    const others = (schedules.data ?? []).filter((s) => s.dayOfWeek !== day);
    schedules.setData(schedule ? [...others, schedule] : others);
  }

  return (
    <>
      <PageHeader title="Horarios" subtitle="Un día sin horario significa que la cancha está cerrada ese día." />
      <div className="card card-body">
        {courts.loading ? (
          <Skeleton height={64} />
        ) : courts.error ? (
          <ErrorState error={courts.error} onRetry={courts.reload} />
        ) : (
          <SelectField label="Cancha" value={courtId} onChange={(e) => setParams({ courtId: e.target.value }, { replace: true })}>
            {courts.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        )}
      </div>

      <section className="section card table-wrap">
        {schedules.loading ? (
          <Skeleton count={7} height={44} />
        ) : schedules.error ? (
          <ErrorState error={schedules.error} onRetry={schedules.reload} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Apertura</th>
                <th scope="col">Cierre</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {WEEK.map((day) => (
                <ScheduleRow
                  key={`${courtId}-${day}`}
                  courtId={courtId}
                  day={day}
                  schedule={schedules.data?.find((s) => s.dayOfWeek === day) ?? null}
                  onChange={(s) => replace(day, s)}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function ScheduleRow({
  courtId,
  day,
  schedule,
  onChange,
}: {
  courtId: string;
  day: DayOfWeek;
  schedule: Schedule | null;
  onChange: (s: Schedule | null) => void;
}) {
  const toast = useToast();
  const [opening, setOpening] = useState(schedule ? hhmm(schedule.openingTime) : "");
  const [closing, setClosing] = useState(schedule ? hhmm(schedule.closingTime) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = !schedule || hhmm(schedule.openingTime) !== opening || hhmm(schedule.closingTime) !== closing;
  const label = DAY_LABEL[day];

  async function save() {
    if (!opening || !closing) {
      setError("Escribe la hora de apertura y la de cierre");
      return;
    }
    if (timeToMinutes(closing) <= timeToMinutes(opening)) {
      setError("La hora de cierre debe ser posterior a la de apertura");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await courtsApi.putSchedule(courtId, day, {
        openingTime: toApiTime(opening),
        closingTime: toApiTime(closing),
      });
      onChange(saved);
      toast(`Horario del ${label.toLowerCase()} guardado`, "success");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function close() {
    setDeleting(true);
    try {
      await courtsApi.deleteSchedule(courtId, day);
      setConfirmOpen(false);
      setOpening("");
      setClosing("");
      onChange(null);
      toast(`La cancha queda cerrada los ${label.toLowerCase()}`, "success");
    } catch (err) {
      setError(errorMessage(err));
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <tr>
      <th scope="row">
        {label}
        {!schedule && <span className="badge badge-neutral badge-inline">Cerrado</span>}
      </th>
      <td>
        <input
          type="time"
          className="input input-time"
          aria-label={`Apertura del ${label.toLowerCase()}`}
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
        />
      </td>
      <td>
        <input
          type="time"
          className="input input-time"
          aria-label={`Cierre del ${label.toLowerCase()}`}
          value={closing}
          onChange={(e) => setClosing(e.target.value)}
        />
        {error && <p className="field-error">{error}</p>}
      </td>
      <td className="cell-actions">
        <Button variant="secondary" loading={saving} disabled={!dirty} onClick={save}>
          Guardar
        </Button>
        {schedule && (
          <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
            Cerrar este día
          </Button>
        )}
        <ConfirmDialog
          open={confirmOpen}
          title={`¿Cerrar la cancha los ${label.toLowerCase()}?`}
          confirmLabel="Sí, cerrar"
          loading={deleting}
          onConfirm={close}
          onCancel={() => setConfirmOpen(false)}
        >
          <p>La cancha dejará de mostrar franjas disponibles ese día de la semana.</p>
        </ConfirmDialog>
      </td>
    </tr>
  );
}
