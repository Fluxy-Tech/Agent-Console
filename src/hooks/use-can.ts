import { PermissionAction, resolvePermissions } from "../domain/permission-action";
import { useAppSelector } from "../store/hooks";

/// Tem papel de plataforma pra atender suporte (Administrador ou flag
/// "support") — independente da empresa ativa. Use só pra decidir se vale
/// oferecer "ir pra central Suporte Sturnus"; pra mostrar telas de suporte,
/// use useIsSupportTeam.
export function useHasSupportRole(): boolean {
  const user = useAppSelector((state) => state.auth.user);
  return !!user && (user.isPlatformAdmin || !!user.isSupportAgent);
}

/// Atuando COMO time de suporte agora: tem o papel E a empresa ativa é a
/// central "Suporte Sturnus". Em qualquer outra empresa a pessoa é só um
/// membro dela (telas e tickets daquela empresa). Espelha
/// AuthUser.actingAsSupport do Agent-Api.
export function useIsSupportTeam(): boolean {
  const hasSupportRole = useHasSupportRole();
  const inSupportHub = useAppSelector((state) => !!state.activeCompany?.isSupportHub);
  return hasSupportRole && inSupportHub;
}

/// Espelha Agent-Api/src/application/authorization/authorization-service.ts —
/// só para esconder/desabilitar UI. A checagem que realmente vale é a do
/// backend; um 403 aqui é o servidor, não este hook, que tem a palavra final.
export function useCan() {
  const user = useAppSelector((state) => state.auth.user);
  const activeCompany = useAppSelector((state) => state.activeCompany);

  return (action: PermissionAction): boolean => {
    if (!user) return false;
    if (user.isPlatformAdmin) return true;
    // Flag de suporte: as telas de suporte só na central Suporte Sturnus
    // (onde não tem papel). Nas outras empresas, vale o papel dele lá.
    if (
      user.isSupportAgent &&
      activeCompany?.isSupportHub &&
      (action === PermissionAction.SUPPORT_VIEW || action === PermissionAction.SUPPORT_WRITE)
    ) {
      return true;
    }
    if (!activeCompany?.memberRole) return false;
    // memberPermissions pode faltar no cache persistido de versões antigas —
    // resolvePermissions cai no padrão do papel nesse caso.
    return resolvePermissions(activeCompany.memberRole, activeCompany.memberPermissions).includes(action);
  };
}
