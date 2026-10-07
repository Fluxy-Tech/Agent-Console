import { useEffect } from "react";
import type { PermissionAction } from "../domain/permission-action";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import type { AppDispatch } from "../store/store";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setActiveCompany, type ActiveCompany } from "../store/slices/active-company-slice";
import { clearAuth, setLoading, setUser } from "../store/slices/auth-slice";

interface Company {
  id: string;
  name: string;
  isSupportHub: boolean;
}

interface Member {
  id: string;
  userId: string;
  role: "GERENTE" | "SUPERVISOR" | "ATENDENTE";
  permissions: PermissionAction[] | null;
}

/// Núcleo de sincronização store↔sessão real do Better Auth (cookie) — extraído
/// como função standalone (não só efeito de hook) para poder ser chamado tanto
/// no boot do app quanto logo após um signIn/signUp bem-sucedido, sem esperar
/// um remount/re-render que nunca viria (o efeito de useBootstrapSession só
/// roda uma vez, perto da raiz — sozinho ele nunca saberia que uma nova sessão
/// acabou de ser criada por uma página completamente diferente).
export async function refreshSessionState(dispatch: AppDispatch): Promise<ActiveCompany | null> {
  dispatch(setLoading());

  const session = await authClient.getSession().catch(() => null);
  const sessionUser = session?.data?.user;
  const sessionData = session?.data?.session;

  if (!sessionUser) {
    dispatch(clearAuth());
    dispatch(setActiveCompany(null));
    return null;
  }

  dispatch(
    setUser({
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      isPlatformAdmin: sessionUser.role === "admin",
      isSupportAgent: sessionUser.role === "support",
    }),
  );

  const activeOrganizationId = sessionData?.activeOrganizationId;
  if (!activeOrganizationId) {
    dispatch(setActiveCompany(null));
    return null;
  }

  try {
    const [company, members] = await Promise.all([
      api.get<Company>(`/api/companies/${activeOrganizationId}`),
      api.get<Member[]>(`/api/companies/${activeOrganizationId}/members`),
    ]);

    const membership = members.find((m) => m.userId === sessionUser.id);

    const activeCompany: ActiveCompany = {
      id: company.id,
      name: company.name,
      memberRole: membership?.role ?? null,
      memberPermissions: membership?.permissions ?? null,
      isSupportHub: company.isSupportHub,
    };
    dispatch(setActiveCompany(activeCompany));
    return activeCompany;
  } catch {
    dispatch(setActiveCompany(null));
    return null;
  }
}

/// Sincroniza a store com a sessão real ao carregar o app — a store persistida
/// é só cache/otimista, isto é a fonte de verdade. Deve ser chamado uma vez,
/// perto da raiz do app.
export function useBootstrapSession() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);

  useEffect(() => {
    refreshSessionState(dispatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ready: status === "ready" };
}
