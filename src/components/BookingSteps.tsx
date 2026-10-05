const STEPS = ["Franja", "Tus datos", "Pago", "Confirmación"];

export function BookingSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="steps" aria-label="Pasos de la reserva">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const state = step < current ? "done" : step === current ? "current" : "todo";
        return (
          <li key={label} className={`step step-${state}`} aria-current={step === current ? "step" : undefined}>
            <span className="step-number">{step}</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
