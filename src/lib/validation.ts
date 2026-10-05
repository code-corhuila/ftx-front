// Validaciones que repiten las del dominio para dar respuesta rápida.
// Nunca reemplazan las del backend (12-ux-ui/design-system.md → Forms).

export interface ContactInput {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

export const normalizePhone = (value: string): string => value.replace(/[\s-]/g, "");

export function validateContact(c: ContactInput): ContactErrors {
  const errors: ContactErrors = {};

  const name = c.customerName.trim();
  if (!name) errors.customerName = "Escribe el nombre de quien hace la reserva";
  else if (name.length > 120) errors.customerName = "El nombre puede tener máximo 120 caracteres";

  if (!/^\+?[0-9]{7,15}$/.test(normalizePhone(c.customerPhone))) {
    errors.customerPhone = "El teléfono debe tener entre 7 y 15 dígitos, por ejemplo +573001234567";
  }

  const email = c.customerEmail.trim();
  if (!email) errors.customerEmail = "Escribe un correo, por ejemplo nombre@correo.com";
  else if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.customerEmail = "Revisa el correo: debe tener la forma nombre@correo.com";
  }

  return errors;
}

/** `reservation-service.yaml#/components/schemas/ReservationCode` (formato final: ADR-007). */
export const RESERVATION_CODE_PATTERN = /^[A-Z0-9]{1,20}$/;

export const normalizeCode = (value: string): string => value.trim().toUpperCase();

/** `customer_email` o `customerEmail` → `customerEmail`. */
export const camelizeField = (field: string): string => field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
