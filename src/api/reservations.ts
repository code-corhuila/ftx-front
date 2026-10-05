// reservation-service — 07-api/contracts/openapi/reservation-service.yaml
import { apiRequest } from "./client";
import type {
  AdminReservationFilters,
  Availability,
  CreateReservationRequest,
  IsoDate,
  Page,
  Reservation,
} from "./types";

const seg = encodeURIComponent;

export const reservationsApi = {
  /** GET /availability (FR-002 a FR-005). Público. */
  availability(courtId: string, date: IsoDate): Promise<Availability> {
    return apiRequest<Availability>({ method: "GET", path: "/availability", query: { courtId, date } });
  },

  /**
   * POST /reservations (FR-006 a FR-011). Público.
   * La misma `idempotencyKey` debe reutilizarse al reintentar la misma intención del usuario.
   */
  create(body: CreateReservationRequest, idempotencyKey: string): Promise<Reservation> {
    return apiRequest<Reservation>({
      method: "POST",
      path: "/reservations",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
    });
  },

  /** GET /reservations/{reservationCode} (FR-016). Público + código. */
  getByCode(code: string): Promise<Reservation> {
    return apiRequest<Reservation>({ method: "GET", path: `/reservations/${seg(code)}` });
  },

  /** POST /reservations/{reservationCode}/cancellation (FR-012 a FR-015). Público + código. */
  cancelByCode(code: string, reason?: string): Promise<Reservation> {
    return apiRequest<Reservation>({
      method: "POST",
      path: `/reservations/${seg(code)}/cancellation`,
      body: reason ? { reason } : {},
    });
  },

  /** GET /admin/reservations (FR-033, FR-034). ADMINISTRATOR. */
  adminList(filters: AdminReservationFilters): Promise<Page<Reservation>> {
    return apiRequest<Page<Reservation>>({ method: "GET", path: "/admin/reservations", query: filters, auth: true });
  },

  /** POST /admin/reservations/{id}/cancellation (FR-012, FR-013, FR-035). ADMINISTRATOR. */
  adminCancel(id: string, reason?: string): Promise<Reservation> {
    return apiRequest<Reservation>({
      method: "POST",
      path: `/admin/reservations/${seg(id)}/cancellation`,
      body: reason ? { reason } : {},
      auth: true,
    });
  },
};
