import { useRef, type KeyboardEvent } from "react";
import type { AvailabilitySlot, IsoTime } from "../api/types";
import { hhmm } from "../lib/format";

/**
 * Grilla de franjas (design-system.md → Time slot state). Libre: clicable. Ocupada: gris,
 * aria-disabled y fuera del orden de tabulación. Se navega con las flechas.
 */
export function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: AvailabilitySlot[];
  selected?: IsoTime;
  onSelect: (start: IsoTime) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const free = slots.map((s, i) => (s.available ? i : -1)).filter((i) => i >= 0);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const pos = free.indexOf(index);
    let target: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        target = Math.min(free.length - 1, pos + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        target = Math.max(0, pos - 1);
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = free.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    refs.current[free[target]]?.focus();
  }

  return (
    <div className="slot-grid" role="group" aria-label="Franjas horarias">
      {slots.map((slot, i) => {
        const label = `${hhmm(slot.startTime)} – ${hhmm(slot.endTime)}`;
        if (!slot.available) {
          return (
            <div key={slot.startTime} className="slot slot-taken" aria-disabled="true">
              {label}
              <span className="sr-only"> (ocupada)</span>
            </div>
          );
        }
        const isSelected = slot.startTime === selected;
        return (
          <button
            key={slot.startTime}
            type="button"
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`slot slot-free ${isSelected ? "slot-selected" : ""}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(slot.startTime)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
