import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { courtsApi } from "../../api/courts";
import type { Court, CourtStatus, UpdateCourtRequest } from "../../api/types";
import { useToast } from "../../components/Toast";
import { Alert, Button, ErrorState, PageHeader, SelectField, Skeleton, TextField } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { invalidateCourts } from "../../hooks/useCourts";
import { COURT_STATUS_TRANSITIONS } from "../../lib/courtRules";
import { errorMessage, fieldErrors } from "../../lib/errors";
import { COURT_STATUS_LABEL } from "../../lib/format";

/** /admin/courts/:courtId/edit — FR-028, FR-030, FR-031. */
export function AdminCourtFormPage() {
  const { courtId = "" } = useParams();
  const court = useAsync(() => courtsApi.get(courtId), [courtId]);

  if (court.loading) return <Skeleton count={4} height={64} />;
  if (court.error || !court.data) return <ErrorState error={court.error} onRetry={court.reload} />;
  return <CourtForm key={court.data.id} court={court.data} />;
}

type Errors = Partial<Record<"name" | "capacity" | "hourlyPrice" | "status", string>>;

function CourtForm({ court }: { court: Court }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(court.name);
  const [capacity, setCapacity] = useState(String(court.capacity));
  const [price, setPrice] = useState(String(court.hourlyPrice.amount));
  const [status, setStatus] = useState<CourtStatus>(court.status);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Solo se ofrecen las transiciones que el dominio permite.
  const statusOptions: CourtStatus[] = [court.status, ...COURT_STATUS_TRANSITIONS[court.status]];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    const trimmed = name.trim();
    const cap = Number(capacity);
    const amount = Number(price);
    if (!trimmed || trimmed.length > 100) next.name = "El nombre debe tener entre 1 y 100 caracteres";
    if (!Number.isInteger(cap) || cap < 1) next.capacity = "Escribe un número entero de jugadores, mínimo 1";
    if (!Number.isInteger(amount) || amount <= 0) {
      next.hourlyPrice = "Escribe el precio en pesos, sin puntos ni decimales, por ejemplo 60000";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // PATCH parcial: solo los campos que cambiaron (UpdateCourtRequest exige al menos uno).
    const patch: UpdateCourtRequest = {};
    if (trimmed !== court.name) patch.name = trimmed;
    if (cap !== court.capacity) patch.capacity = cap;
    if (amount !== court.hourlyPrice.amount) patch.hourlyPrice = { amount, currency: "COP" };
    if (status !== court.status) patch.status = status;
    if (Object.keys(patch).length === 0) {
      setFormError("No hay cambios para guardar.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await courtsApi.update(court.id, patch);
      invalidateCourts();
      toast(`${trimmed} actualizada`, "success");
      navigate("/admin/courts");
    } catch (err) {
      setErrors(fieldErrors(err) as Errors);
      setFormError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="narrow">
      <p className="breadcrumb">
        <Link to="/admin/courts">Canchas</Link> / {court.name}
      </p>
      <PageHeader title={`Editar ${court.name}`} />
      <form className="card card-body stack" onSubmit={onSubmit} noValidate>
        <TextField label="Nombre" value={name} maxLength={100} error={errors.name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Capacidad (jugadores)"
          type="number"
          min={1}
          step={1}
          value={capacity}
          error={errors.capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
        <TextField
          label="Precio por hora (COP)"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={price}
          error={errors.hourlyPrice}
          hint="Pesos colombianos enteros. Las reservas existentes conservan su valor."
          onChange={(e) => setPrice(e.target.value)}
        />
        <SelectField
          label="Estado"
          value={status}
          error={errors.status}
          onChange={(e) => setStatus(e.target.value as CourtStatus)}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {COURT_STATUS_LABEL[s]}
            </option>
          ))}
        </SelectField>
        {status !== "ACTIVE" && (
          <Alert tone="warning">Mientras no esté disponible, la cancha no mostrará franjas para reservar.</Alert>
        )}
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="actions">
          <Link to="/admin/courts" className="btn btn-secondary">
            Cancelar
          </Link>
          <Button type="submit" variant="primary" loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
