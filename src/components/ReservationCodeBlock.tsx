import { useToast } from "./Toast";
import { Button } from "./ui";

/**
 * Bloque del código de reserva (design-system.md → Reservation code block).
 * Sin cuenta ni notificaciones, perder el código es perder la reserva.
 */
export function ReservationCodeBlock({ code }: { code: string }) {
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast("Código copiado", "success");
    } catch {
      toast("No se pudo copiar. Selecciona el código y cópialo manualmente.", "error");
    }
  }

  return (
    <section className="code-block" aria-label="Código de reserva">
      <p className="code-label">Tu código de reserva</p>
      <p className="code-value" translate="no">
        {code}
      </p>
      <div className="code-actions no-print">
        <Button onClick={copy}>Copiar código</Button>
        <Button variant="ghost" onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>
      <p className="code-warning">Guarda este código: es la única forma de consultar tu reserva.</p>
    </section>
  );
}
