// Tipos de los contratos OpenAPI de ftx-docs/07-api/contracts/openapi/.
// Si un contrato cambia, este archivo cambia en el mismo pull request.

export type UUID = string;
/** `YYYY-MM-DD` */
export type IsoDate = string;
/** `HH:mm:ss` */
export type IsoTime = string;
/** ISO 8601 con zona horaria. */
export type Timestamp = string;

// ─── _shared.yaml ────────────────────────────────────────────────────────────

/** Pesos colombianos enteros. La API nunca expone decimales. */
export interface Money {
  amount: number;
  currency: "COP";
}

export interface ErrorDetail {
  field?: string;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: ErrorDetail[];
  traceId?: string;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface DataList<T> {
  data: T[];
}

// ─── court-service.yaml ──────────────────────────────────────────────────────

export type CourtStatus = "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE";
export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface Court {
  id: UUID;
  name: string;
  sport: "FOOTBALL";
  capacity: number;
  hourlyPrice: Money;
  status: CourtStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UpdateCourtRequest {
  name?: string;
  capacity?: number;
  hourlyPrice?: Money;
  status?: CourtStatus;
}

export interface Schedule {
  id: UUID;
  courtId: UUID;
  dayOfWeek: DayOfWeek;
  openingTime: IsoTime;
  closingTime: IsoTime;
}

export interface ScheduleRequest {
  openingTime: IsoTime;
  closingTime: IsoTime;
}

// ─── reservation-service.yaml ────────────────────────────────────────────────

export type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "REJECTED";
export type CancelledBy = "CUSTOMER" | "ADMINISTRATOR";

export interface AvailabilitySlot {
  startTime: IsoTime;
  endTime: IsoTime;
  available: boolean;
}

export interface Availability {
  courtId: UUID;
  date: IsoDate;
  hourlyPrice: Money;
  hasAvailability: boolean;
  slots: AvailabilitySlot[];
}

export interface CreateReservationRequest {
  courtId: UUID;
  reservationDate: IsoDate;
  startTime: IsoTime;
  endTime: IsoTime;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface CancelReservationRequest {
  reason?: string;
}

export interface Reservation {
  id: UUID;
  reservationCode: string;
  courtId: UUID;
  reservationDate: IsoDate;
  startTime: IsoTime;
  endTime: IsoTime;
  status: ReservationStatus;
  amount: Money;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  cancelledAt?: Timestamp | null;
  cancelledBy?: CancelledBy | null;
  cancellationReason?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AdminReservationFilters = {
  page?: number;
  limit?: number;
  status?: ReservationStatus;
  courtId?: UUID;
  dateFrom?: IsoDate;
  dateTo?: IsoDate;
};

// ─── payment-service.yaml (Proposed v0.1.0) ──────────────────────────────────

export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED";

export interface StartCheckoutRequest {
  reservationCode: string;
}

export interface CheckoutResponse {
  status: "PENDING";
  amount: Money;
  checkoutUrl: string;
}

// ─── user-service (archivo auth-service.yaml) ────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AdministratorSummary {
  id: UUID;
  email: string;
  role: "ADMINISTRATOR";
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AdministratorSummary;
}

export interface LogoutRequest {
  refreshToken?: string;
  allDevices?: boolean;
}
