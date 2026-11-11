import { describe, expect, it } from "vitest";
import { domainOf, parseRealDomains, usesRealBackend } from "./routing";
import { realAdministratorTokenLooksValid } from "./mock/server";

const COURT = "c0000000-0000-4000-8000-000000000001";

describe("domainOf", () => {
  it("reparte cada ruta del contrato a su servicio (ADR-011, ADR-012)", () => {
    expect(domainOf("/auth/login")).toBe("auth");
    expect(domainOf("/auth/jwks")).toBe("auth");
    expect(domainOf("/courts")).toBe("courts");
    expect(domainOf(`/courts/${COURT}`)).toBe("courts");
    expect(domainOf(`/admin/courts/${COURT}`)).toBe("courts");
    expect(domainOf(`/courts/${COURT}/schedules`)).toBe("schedules");
    expect(domainOf(`/courts/${COURT}/bookable-slots`)).toBe("schedules");
    expect(domainOf(`/admin/courts/${COURT}/schedules/MON`)).toBe("schedules");
    expect(domainOf("/availability")).toBe("reservations");
    expect(domainOf("/reservations/FTX7Q2K9M4")).toBe("reservations");
    expect(domainOf("/admin/reservations")).toBe("reservations");
    expect(domainOf("/payments/checkouts")).toBe("payments");
    expect(domainOf("/health")).toBe("other");
  });

  it("no confunde prefijos parecidos", () => {
    expect(domainOf("/authors")).toBe("other");
    expect(domainOf("/courtside")).toBe("other");
    expect(domainOf(`/courts/${COURT}/schedulesX`)).toBe("courts");
  });
});

describe("modo mixto", () => {
  const real = parseRealDomains(" Auth, courts,schedules,unknown ");

  it("lee solo los nombres conocidos", () => {
    expect([...real].sort()).toEqual(["auth", "courts", "schedules"]);
    expect(parseRealDomains(undefined).size).toBe(0);
  });

  it("con simulación, solo los dominios listados van por HTTP", () => {
    expect(usesRealBackend("/auth/login", true, real)).toBe(true);
    expect(usesRealBackend(`/admin/courts/${COURT}`, true, real)).toBe(true);
    expect(usesRealBackend("/reservations", true, real)).toBe(false);
    expect(usesRealBackend("/payments/checkouts", true, real)).toBe(false);
    expect(usesRealBackend("/health", true, real)).toBe(false);
  });

  it("sin simulación todo va por HTTP, haya o no lista", () => {
    expect(usesRealBackend("/reservations", false, new Set())).toBe(true);
  });
});

describe("token real dentro del simulador", () => {
  const encode = (payload: object) =>
    `h.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.s`;
  const now = Date.parse("2026-11-11T15:00:00Z");

  it("acepta un administrador vigente y rechaza lo demás", () => {
    expect(realAdministratorTokenLooksValid(encode({ exp: now / 1000 + 60, roles: ["ADMINISTRATOR"] }), now)).toBe(true);
    expect(realAdministratorTokenLooksValid(encode({ exp: now / 1000 - 1, roles: ["ADMINISTRATOR"] }), now)).toBe(false);
    expect(realAdministratorTokenLooksValid(encode({ exp: now / 1000 + 60, roles: ["CUSTOMER"] }), now)).toBe(false);
    expect(realAdministratorTokenLooksValid(encode({ roles: ["ADMINISTRATOR"] }), now)).toBe(false);
    expect(realAdministratorTokenLooksValid("no-es-un-jwt", now)).toBe(false);
    expect(realAdministratorTokenLooksValid("", now)).toBe(false);
  });
});
