// payment-service — 07-api/contracts/openapi/payment-service.yaml (Proposed v0.1.0)
import { apiRequest } from "./client";
import type { CheckoutResponse } from "./types";

export const paymentsApi = {
  /**
   * POST /payments/checkouts (HU-PAY-003). Público.
   * Devuelve la URL de Wompi Sandbox. Un 404 justo después de crear la reserva puede ser
   * transitorio: el pago se registra de forma asíncrona al consumir `ReservationCreated`.
   */
  startCheckout(reservationCode: string, idempotencyKey: string): Promise<CheckoutResponse> {
    return apiRequest<CheckoutResponse>({
      method: "POST",
      path: "/payments/checkouts",
      body: { reservationCode },
      headers: { "Idempotency-Key": idempotencyKey },
    });
  },
};
