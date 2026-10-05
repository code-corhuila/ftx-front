import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Alert, Button } from "./ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmación antes de una acción destructiva (design-system.md → UX patterns, principio 1). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Volver",
  tone = "danger",
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("textarea, input, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => !loading && onCancel()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="modal-actions">
          <Button onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Diálogo de cancelación de reserva con motivo opcional (FR-035). */
export function CancelReservationDialog({
  open,
  code,
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  code: string;
  loading: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const fieldId = useId();

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <ConfirmDialog
      open={open}
      title="¿Cancelar esta reserva?"
      confirmLabel="Sí, cancelar reserva"
      loading={loading}
      error={error}
      onConfirm={() => onConfirm(reason.trim())}
      onCancel={onCancel}
    >
      <p>
        La reserva <span className="mono">{code}</span> quedará cancelada y la franja se liberará para otras
        personas. Esta acción no se puede deshacer.
      </p>
      <div className="field">
        <label htmlFor={fieldId}>Motivo (opcional)</label>
        <textarea
          id={fieldId}
          className="input"
          rows={3}
          maxLength={255}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}
