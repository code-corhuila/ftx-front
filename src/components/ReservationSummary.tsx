import type { IsoDate, IsoTime, Money } from "../api/types";
import { formatDate, formatMoney, hhmm } from "../lib/format";

export function ReservationSummary({
  courtName,
  date,
  startTime,
  endTime,
  amount,
}: {
  courtName: string;
  date: IsoDate;
  startTime: IsoTime;
  endTime: IsoTime;
  amount?: Money;
}) {
  return (
    <dl className="summary">
      <div>
        <dt>Cancha</dt>
        <dd>{courtName}</dd>
      </div>
      <div>
        <dt>Fecha</dt>
        <dd className="capitalize">{formatDate(date)}</dd>
      </div>
      <div>
        <dt>Horario</dt>
        <dd>
          {hhmm(startTime)} – {hhmm(endTime)}
        </dd>
      </div>
      {amount && (
        <div>
          <dt>Valor</dt>
          <dd>{formatMoney(amount)}</dd>
        </div>
      )}
    </dl>
  );
}
