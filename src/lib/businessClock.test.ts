import { describe, expect, it } from "vitest";
import { businessNow, businessToday, isPastStart } from "./businessClock";

// Los instantes se escriben en UTC para que las pruebas no dependan de la zona del equipo
// que las ejecuta. Bogotá es UTC−5 todo el año.
const at = (iso: string) => new Date(iso);
const SIX_PM = at("2026-10-13T23:00:00Z"); // martes 13 de octubre de 2026, 18:00 en Bogotá

describe("businessNow (America/Bogota)", () => {
  it("convierte el instante a la hora del negocio", () => {
    expect(businessNow(SIX_PM)).toEqual({ date: "2026-10-13", minutes: 18 * 60 });
  });

  it("usa el día del negocio aunque en UTC ya sea el día siguiente", () => {
    // 01:30 UTC del 14 = 20:30 del 13 en Bogotá
    expect(businessNow(at("2026-10-14T01:30:00Z"))).toEqual({ date: "2026-10-13", minutes: 20 * 60 + 30 });
  });

  it("cambia de día y de mes en la medianoche del negocio, no en la de UTC", () => {
    expect(businessToday(at("2026-11-01T04:59:00Z"))).toBe("2026-10-31");
    expect(businessToday(at("2026-11-01T05:00:00Z"))).toBe("2026-11-01");
  });
});

describe("isPastStart — una reserva debe empezar en el minuto actual o después", () => {
  it("rechaza las horas anteriores del mismo día (a las 18:00, 17:59 y antes)", () => {
    expect(isPastStart("2026-10-13", "17:59:00", SIX_PM)).toBe(true);
    expect(isPastStart("2026-10-13", "17:00:00", SIX_PM)).toBe(true);
    expect(isPastStart("2026-10-13", "08:00:00", SIX_PM)).toBe(true);
  });

  it("acepta la franja que empieza exactamente en el minuto actual", () => {
    expect(isPastStart("2026-10-13", "18:00:00", SIX_PM)).toBe(false);
    expect(isPastStart("2026-10-13", "18:00:00", at("2026-10-13T23:00:59Z"))).toBe(false);
  });

  it("rechaza esa misma franja un minuto después de empezar", () => {
    expect(isPastStart("2026-10-13", "18:00:00", at("2026-10-13T23:01:00Z"))).toBe(true);
  });

  it("acepta horas futuras del mismo día", () => {
    expect(isPastStart("2026-10-13", "19:00:00", SIX_PM)).toBe(false);
    expect(isPastStart("2026-10-13", "21:00:00", SIX_PM)).toBe(false);
  });

  it("acepta cualquier hora de una fecha futura y rechaza cualquiera de una fecha pasada", () => {
    expect(isPastStart("2026-10-14", "06:00:00", SIX_PM)).toBe(false);
    expect(isPastStart("2026-10-12", "23:00:00", SIX_PM)).toBe(true);
  });

  it("compara con la hora de Bogotá aunque la fecha UTC ya haya cambiado", () => {
    const evening = at("2026-10-14T01:30:00Z"); // 20:30 del 13 en Bogotá
    expect(isPastStart("2026-10-13", "21:00:00", evening)).toBe(false);
    expect(isPastStart("2026-10-13", "20:00:00", evening)).toBe(true);
  });

  it("funciona al cambiar de mes", () => {
    const lastMinuteOfOctober = at("2026-11-01T04:59:00Z"); // 23:59 del 31 de octubre en Bogotá
    expect(isPastStart("2026-10-31", "22:00:00", lastMinuteOfOctober)).toBe(true);
    expect(isPastStart("2026-11-01", "07:00:00", lastMinuteOfOctober)).toBe(false);
  });
});
