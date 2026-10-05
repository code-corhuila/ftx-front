import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { MOCK_WEBHOOK_SIGNATURE } from "../api/mock/constants";
import { reservationsApi } from "../api/reservations";
import { Alert, Button, ErrorState, Skeleton } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { formatMoney } from "../lib/format";
import { normalizeCode } from "../lib/validation";

/**
 * Pasarela simulada (solo VITE_API_MOCK=true). Reemplaza el checkout de Wompi Sandbox:
 * envía el webhook firmado al payment-service y redirige de vuelta al frontend, como haría Wompi.
 */
export function MockWompiPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const transaction = params.get("transaction") ?? "";
  const code = normalizeCode(params.get("code") ?? "");
  const reservation = useAsync(() => reservationsApi.getByCode(code), [code]);
  const [busy, setBusy] = useState<"APPROVED" | "DECLINED" | null>(null);

  async function finish(status: "APPROVED" | "DECLINED" | null) {
    if (status) {
      setBusy(status);
      try {
        await apiRequest<void>({
          method: "POST",
          path: "/payments/wompi/webhook",
          body: { transactionId: transaction, status },
          headers: { "X-Event-Checksum": MOCK_WEBHOOK_SIGNATURE },
        });
      } catch {
        // Wompi redirige igual; el resultado real llega por el webhook.
      }
    }
    navigate(`/booking/confirmation/${code}?${new URLSearchParams({ id: transaction })}`, { replace: true });
  }

  return (
    <div className="narrow">
      <div className="card wompi-card">
        <div className="wompi-header">
          <strong>Wompi</strong> <span className="badge badge-info">Sandbox simulado</span>
        </div>
        <div className="card-body stack">
          {reservation.loading ? (
            <Skeleton count={2} height={40} />
          ) : reservation.error || !reservation.data ? (
            <ErrorState error={reservation.error} />
          ) : (
            <>
              <p className="muted">Pago a Futbolix</p>
              <p className="wompi-amount">{formatMoney(reservation.data.amount)}</p>
              <p className="small">
                Referencia <span className="mono">{transaction}</span> · Reserva{" "}
                <span className="mono">{reservation.data.reservationCode}</span>
              </p>
              <Alert tone="info">
                Esta pantalla reemplaza a Wompi en el modo simulado. En el sistema real el cliente escribe los datos de
                su tarjeta aquí, en Wompi, y Futbolix nunca los recibe.
              </Alert>
              <div className="actions">
                <Button variant="primary" loading={busy === "APPROVED"} disabled={busy !== null} onClick={() => finish("APPROVED")}>
                  Aprobar pago
                </Button>
                <Button variant="danger" loading={busy === "DECLINED"} disabled={busy !== null} onClick={() => finish("DECLINED")}>
                  Rechazar pago
                </Button>
                <Button variant="ghost" disabled={busy !== null} onClick={() => finish(null)}>
                  Volver sin pagar
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
