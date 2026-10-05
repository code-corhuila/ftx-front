import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { session, useSession } from "../auth/session";

/** Todo /admin (salvo /admin/login) exige sesión; si no, redirige al login (navigation-map.md). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const current = useSession();
  const location = useLocation();
  if (!current) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname + location.search, expired: session.wasExpired() }}
      />
    );
  }
  return <>{children}</>;
}
