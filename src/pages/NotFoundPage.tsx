import { ButtonLink, EmptyState } from "../components/ui";

export function NotFoundPage() {
  return (
    <EmptyState title="Esta página no existe" action={<ButtonLink to="/">Volver al inicio</ButtonLink>}>
      Revisa la dirección o vuelve al inicio para reservar una cancha.
    </EmptyState>
  );
}
