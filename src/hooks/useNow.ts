import { useEffect, useState } from "react";

/** Hora actual que se refresca periódicamente, para que la interfaz no se quede con una hora vieja. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}
