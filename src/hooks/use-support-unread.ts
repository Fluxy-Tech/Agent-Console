import useSWR, { mutate } from "swr";
import { PermissionAction } from "@/domain/permission-action";
import { useAppSelector } from "@/store/hooks";
import type { SupportUnread } from "@/types/domain";
import { useCan } from "./use-can";

const SUPPORT_UNREAD_PATH = "/api/support/unread";

/// Não lidas do suporte técnico do usuário logado, em polling (20s). A
/// empresa ativa entra na chave só pra separar o cache por empresa (a API
/// usa a empresa da sessão e ignora o parâmetro) — sem isso, ao trocar de
/// empresa o menu mostraria por um instante o número da anterior. Mesma
/// chave em todo lugar: o SWR deduplica numa requisição só.
export function useSupportUnread() {
  const can = useCan();
  const companyId = useAppSelector((state) => state.activeCompany?.id);
  const key = can(PermissionAction.SUPPORT_VIEW) && companyId ? `${SUPPORT_UNREAD_PATH}?company=${companyId}` : null;

  return useSWR<SupportUnread>(key, {
    refreshInterval: 20000,
    // Mesmo com a aba em segundo plano — é justamente quando a notificação
    // do navegador faz diferença.
    refreshWhenHidden: true,
  });
}

/// Força a releitura das não lidas (ex: depois de marcar um chamado como lido).
export function refreshSupportUnread() {
  return mutate((key) => typeof key === "string" && key.startsWith(SUPPORT_UNREAD_PATH));
}
