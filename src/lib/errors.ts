import { ApiError, NetworkError } from "../api/client";
import { camelizeField } from "./validation";

// Los mensajes del backend están en inglés (contratos de 07). La interfaz es en español,
// así que se traduce por el código estable `error`, nunca por el texto.
const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Revisa los datos marcados e inténtalo de nuevo.",
  BUSINESS_RULE_VIOLATION: "La reserva no cumple las reglas de la cancha. Revisa la fecha y el horario.",
  RESERVATION_SLOT_UNAVAILABLE: "Esa franja acaba de ser reservada.",
  RESERVATION_NOT_CANCELLABLE: "Esta reserva ya no se puede cancelar.",
  CANCELLATION_NOT_ALLOWED: "Esta reserva no cumple las condiciones para cancelarse.",
  COURT_NOT_FOUND: "La cancha seleccionada no existe.",
  PAYMENT_NOT_PENDING: "El pago de esta reserva ya no se puede iniciar.",
  INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
  INVALID_REFRESH_TOKEN: "Tu sesión expiró. Inicia sesión de nuevo.",
  INVALID_COURT_STATUS_TRANSITION:
    "Ese cambio de estado no está permitido. Una cancha en mantenimiento o inactiva solo puede volver a Disponible.",
  INVALID_SCHEDULE: "La hora de cierre debe ser posterior a la de apertura.",
  TOO_MANY_REQUESTS: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
  SERVICE_UNAVAILABLE: "El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.",
  UNAUTHORIZED: "Tu sesión expiró. Inicia sesión de nuevo.",
  FORBIDDEN: "No tienes permiso para ver esto.",
  NOT_FOUND: "No encontramos lo que buscas.",
  CONFLICT: "La operación entra en conflicto con el estado actual. Recarga e inténtalo de nuevo.",
  INTERNAL_ERROR: "Ocurrió un error inesperado. Intenta de nuevo.",
};

export function errorMessage(err: unknown): string {
  if (err instanceof NetworkError) {
    return "Sin conexión con el servidor. Revisa tu conexión e intenta de nuevo.";
  }
  if (err instanceof ApiError) {
    const known = MESSAGES[err.code];
    if (known) return known;
    if (err.status === 401) return MESSAGES.UNAUTHORIZED;
    if (err.status === 403) return MESSAGES.FORBIDDEN;
    if (err.status === 404) return MESSAGES.NOT_FOUND;
    if (err.status === 429) return MESSAGES.TOO_MANY_REQUESTS;
    if (err.status === 503) return MESSAGES.SERVICE_UNAVAILABLE;
    if (err.status >= 500) return MESSAGES.INTERNAL_ERROR;
    return "No pudimos completar la operación.";
  }
  return "Ocurrió un error inesperado.";
}

export const isApiError = (err: unknown, status?: number): err is ApiError =>
  err instanceof ApiError && (status === undefined || err.status === status);

/** Errores por campo de `ErrorResponse.details`, con el nombre del campo en camelCase. */
export function fieldErrors(err: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (err instanceof ApiError) {
    for (const d of err.body.details ?? []) {
      if (d.field && d.message) result[camelizeField(d.field)] = d.message;
    }
  }
  return result;
}

/** Detalles sin campo asociado, para mostrarlos en la alerta general. */
export function generalDetails(err: unknown): string[] {
  if (!(err instanceof ApiError)) return [];
  return (err.body.details ?? []).filter((d) => !d.field && d.message).map((d) => d.message as string);
}
