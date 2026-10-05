import type { IsoDate, IsoTime, Reservation } from "../api/types";
import { readJson, writeJson } from "./storage";

// Mitigación "Tus reservas recientes" de 12-ux-ui/navigation-map.md (el cliente puede perder
// el código). Solo ayuda en el mismo dispositivo y se guarda únicamente en este navegador.

export interface RecentReservation {
  code: string;
  courtName: string;
  date: IsoDate;
  startTime: IsoTime;
}

const KEY = "ftx.recent-reservations";
const MAX = 5;

export const getRecent = (): RecentReservation[] => readJson<RecentReservation[]>("local", KEY) ?? [];

export function rememberReservation(r: Reservation, courtName: string): void {
  const entry: RecentReservation = {
    code: r.reservationCode,
    courtName,
    date: r.reservationDate,
    startTime: r.startTime,
  };
  const others = getRecent().filter((x) => x.code !== entry.code);
  writeJson("local", KEY, [entry, ...others].slice(0, MAX));
}

export function forgetReservation(code: string): void {
  writeJson(
    "local",
    KEY,
    getRecent().filter((x) => x.code !== code),
  );
}
