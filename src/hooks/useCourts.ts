import { courtsApi } from "../api/courts";
import type { Court } from "../api/types";
import { useAsync } from "./useAsync";

// Las cuatro canchas se consultan en casi todas las pantallas: se guardan 60 s en memoria.
const TTL_MS = 60_000;
let cache: { at: number; promise: Promise<Court[]> } | null = null;

export function loadCourts(force = false): Promise<Court[]> {
  if (force || !cache || Date.now() - cache.at > TTL_MS) {
    const promise = courtsApi.list().catch((err: unknown) => {
      cache = null;
      throw err;
    });
    cache = { at: Date.now(), promise };
  }
  return cache.promise;
}

export function invalidateCourts(): void {
  cache = null;
}

export function useCourts(force = false) {
  return useAsync(() => loadCourts(force), [force]);
}

export const courtNameOf = (courts: Court[] | undefined, id: string): string =>
  courts?.find((c) => c.id === id)?.name ?? "Cancha";
