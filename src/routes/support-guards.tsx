import { useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LifeBuoy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHasSupportRole, useIsSupportTeam } from "@/hooks/use-can";
import { api, ApiError } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { setActiveCompany } from "@/store/slices/active-company-slice";

/// Id fixo da central "Suporte Sturnus" (Agent-Api, support-organization.ts).
const SUPPORT_HUB_COMPANY_ID = "suporte-sturnus";

/// Telas fixas da área do time de suporte que NÃO são um ticket.
const SUPPORT_STATIC_PAGES = new Set(["dashboard", "team"]);

/// Quem é do time de suporte mas está numa empresa cliente: as telas de
/// atendimento só existem na central — oferece trocar pra ela e voltar pra
/// mesma tela (ex: veio do link de um e-mail).
function SwitchToSupportHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [switching, setSwitching] = useState(false);

  async function handleSwitch() {
    setSwitching(true);
    try {
      const company = await api.post<{ id: string; name: string }>("/api/session/active-company", {
        companyId: SUPPORT_HUB_COMPANY_ID,
      });
      dispatch(
        setActiveCompany({ id: company.id, name: company.name, memberRole: null, memberPermissions: null, isSupportHub: true }),
      );
      navigate(location.pathname, { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível acessar a Suporte Sturnus.");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center gap-4 p-8 text-center shadow-xl">
        <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
          <LifeBuoy className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold">As telas de suporte ficam na central Suporte Sturnus</p>
          <p className="text-muted-foreground text-sm">
            Você está acessando uma empresa — aqui valem só as telas liberadas para você nela. Para atender os
            tickets, entre na central.
          </p>
        </div>
        <Button onClick={handleSwitch} disabled={switching}>
          {switching ? <Loader2 className="size-4 animate-spin" /> : <LifeBuoy className="size-4" />}
          Ir para a Suporte Sturnus
        </Button>
      </Card>
    </div>
  );
}

/// Área do TIME DE SUPORTE (/support/...): só atuando como suporte, ou seja,
/// com papel de suporte E dentro da central Suporte Sturnus.
/// - Tem o papel mas está numa empresa cliente → oferece trocar pra central.
/// - Não tem o papel (empresa) → vai pra área dela, no mesmo ticket se for o
///   link de um.
export function SupportTeamOnly() {
  const actingAsSupport = useIsSupportTeam();
  const hasSupportRole = useHasSupportRole();
  const location = useLocation();

  if (actingAsSupport) return <Outlet />;
  if (hasSupportRole) return <SwitchToSupportHub />;

  const ticketId = location.pathname.match(/^\/support\/([^/]+)$/)?.[1];
  const target = ticketId && !SUPPORT_STATIC_PAGES.has(ticketId) ? `/technical-support/${ticketId}` : "/technical-support";
  return <Navigate to={target} replace />;
}

/// Área das EMPRESAS (/technical-support/...): qualquer um que NÃO esteja
/// atuando como suporte — inclusive quem tem a flag mas está numa empresa
/// cliente (aí ele é membro dela). Dentro da central, vai pra área de
/// atendimento, no mesmo ticket.
export function CustomerSupportOnly() {
  const actingAsSupport = useIsSupportTeam();
  const location = useLocation();
  if (!actingAsSupport) return <Outlet />;

  const ticketId = location.pathname.match(/^\/technical-support\/([^/]+)$/)?.[1];
  return <Navigate to={ticketId ? `/support/${ticketId}` : "/support"} replace />;
}
