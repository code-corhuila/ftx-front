import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AvailabilitySlot } from "../api/types";
import { SlotGrid } from "../components/SlotGrid";
import { withPastSlotsDisabled } from "./booking";

const SIX_PM = new Date("2026-10-13T23:00:00Z"); // 18:00 en Bogotá
const LATE_OCTOBER_31 = new Date("2026-11-01T04:30:00Z"); // 23:30 del 31 de octubre en Bogotá

const slot = (hour: number, available = true): AvailabilitySlot => ({
  startTime: `${String(hour).padStart(2, "0")}:00:00`,
  endTime: `${String(hour + 1).padStart(2, "0")}:00:00`,
  available,
});

// 16:00 y 17:00 ya empezaron, 18:00 empieza ahora, 19:00 está reservada.
const daySlots = [slot(16), slot(17), slot(18), slot(19, false)];

describe("withPastSlotsDisabled", () => {
  it("deshabilita las franjas que ya empezaron hoy y conserva las demás", () => {
    expect(withPastSlotsDisabled(daySlots, "2026-10-13", SIX_PM).map((s) => s.available)).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it("no toca las franjas de una fecha futura", () => {
    expect(withPastSlotsDisabled(daySlots, "2026-10-14", SIX_PM).map((s) => s.available)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("respeta el cambio de mes según la hora del negocio", () => {
    const october31 = withPastSlotsDisabled([slot(21), slot(22)], "2026-10-31", LATE_OCTOBER_31);
    const november1 = withPastSlotsDisabled([slot(7), slot(8)], "2026-11-01", LATE_OCTOBER_31);
    expect(october31.every((s) => !s.available)).toBe(true);
    expect(november1.every((s) => s.available)).toBe(true);
  });
});

describe("SlotGrid con franjas pasadas", () => {
  it("muestra las franjas pasadas deshabilitadas y solo deja seleccionar las que no han empezado", () => {
    const html = renderToStaticMarkup(
      <SlotGrid slots={withPastSlotsDisabled(daySlots, "2026-10-13", SIX_PM)} onSelect={() => {}} />,
    );
    const buttons = html.match(/<button[^>]*>[^<]*/g) ?? [];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain("18:00 – 19:00");
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-disabled="true">16:00 – 17:00/);
    expect(html).toMatch(/aria-disabled="true">17:00 – 18:00/);
  });
});
