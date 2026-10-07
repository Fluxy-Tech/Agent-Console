import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import { homePathFor } from "@/store/slices/active-company-slice";

export function RequireAuth() {
  const status = useAppSelector((s) => s.auth.status);
  const user = useAppSelector((s) => s.auth.user);

  if (status !== "ready") return null;
  if (!user) return <Navigate to="/signin" replace />;

  return <Outlet />;
}

export function RequireActiveCompany() {
  const status = useAppSelector((s) => s.auth.status);
  const activeCompany = useAppSelector((s) => s.activeCompany);

  if (status !== "ready") return null;
  if (!activeCompany) return <Navigate to="/business" replace />;

  return <Outlet />;
}

/// Usado nas rotas de /signin, /signup, /business — se já tem sessão E empresa
/// ativa, não faz sentido ficar nelas.
export function RedirectIfBootstrapped({ children }: { children: React.ReactNode }) {
  const status = useAppSelector((s) => s.auth.status);
  const user = useAppSelector((s) => s.auth.user);
  const activeCompany = useAppSelector((s) => s.activeCompany);

  if (status !== "ready") return null;
  if (user) return <Navigate to={homePathFor(activeCompany)} replace />;

  return <>{children}</>;
}
