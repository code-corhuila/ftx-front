import type { CourtStatus } from "../api/types";

/**
 * Transiciones de estado permitidas (02-domain/entities-and-rules.md, citado en court-service.yaml):
 * ACTIVE ↔ INACTIVE, ACTIVE ↔ UNDER_MAINTENANCE.
 */
export const COURT_STATUS_TRANSITIONS: Record<CourtStatus, CourtStatus[]> = {
  ACTIVE: ["INACTIVE", "UNDER_MAINTENANCE"],
  INACTIVE: ["ACTIVE"],
  UNDER_MAINTENANCE: ["ACTIVE"],
};

export const COURT_STATUSES: CourtStatus[] = ["ACTIVE", "INACTIVE", "UNDER_MAINTENANCE"];

/** Duración máxima que ofrece la interfaz (12-ux-ui/navigation-map.md: 1, 2 o 3 horas). */
export const MAX_BOOKING_HOURS = 3;
