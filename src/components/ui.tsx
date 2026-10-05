import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../lib/errors";
import { COURT_STATUS_LABEL, PAYMENT_STATUS_LABEL, RESERVATION_STATUS_LABEL } from "../lib/format";

// ─── Botones (design-system.md → Buttons) ────────────────────────────────────

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  variant = "secondary",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className="spinner spinner-sm" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant = "secondary",
  className = "",
  children,
}: {
  to: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`btn btn-${variant} ${className}`}>
      {children}
    </Link>
  );
}

// ─── Estados (design-system.md → Domain status colours) ──────────────────────

const TONE: Record<string, string> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CANCELLED: "neutral",
  REJECTED: "error",
  APPROVED: "success",
  REFUNDED: "info",
  ACTIVE: "success",
  INACTIVE: "neutral",
  UNDER_MAINTENANCE: "warning",
};

export function StatusBadge({ kind, status }: { kind: "reservation" | "payment" | "court"; status: string }) {
  const labels: Record<string, string> =
    kind === "reservation" ? RESERVATION_STATUS_LABEL : kind === "payment" ? PAYMENT_STATUS_LABEL : COURT_STATUS_LABEL;
  return <span className={`badge badge-${TONE[status] ?? "neutral"}`}>{labels[status] ?? status}</span>;
}

// ─── Mensajes ────────────────────────────────────────────────────────────────

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`alert alert-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {title && <p className="alert-title">{title}</p>}
      {children && <div className="alert-body">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <Alert tone="error" title={title ?? "No pudimos cargar la información"}>
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </Alert>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="spinner-row" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ count = 1, height = 48, grid = false }: { count?: number; height?: number; grid?: boolean }) {
  return (
    <div className={grid ? "grid grid-cards" : "stack"} aria-busy="true" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">⚽</div>
      <p className="empty-title">{title}</p>
      {children && <div className="muted">{children}</div>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

// ─── Formularios (design-system.md → Forms) ──────────────────────────────────

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

export function TextField({
  label,
  error,
  hint,
  id,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={`field ${error ? "field-invalid" : ""} ${className}`}>
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...rest}
      />
      {hint && (
        <p id={`${fieldId}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  error,
  id,
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={`field ${error ? "field-invalid" : ""} ${className}`}>
      <label htmlFor={fieldId}>{label}</label>
      <select
        id={fieldId}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, undefined, error)}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p id={`${fieldId}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
