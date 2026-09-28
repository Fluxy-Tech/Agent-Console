import { resolvePermissions, type PermissionAction } from "../domain/permission-action";
import { useAppSelector } from "../store/hooks";

/// Espelha Agent-Api/src/application/authorization/authorization-service.ts —
/// só para esconder/desabilitar UI. A checagem que realmente vale é a do
/// backend; um 403 aqui é o servidor, não este hook, que tem a palavra final.
export function useCan() {
  const user = useAppSelector((state) => state.auth.user);
  const activeCompany = useAppSelector((state) => state.activeCompany);

  return (action: PermissionAction): boolean => {
    if (!user) return false;
    if (user.isPlatformAdmin) return true;
    if (!activeCompany?.memberRole) return false;
    // memberPermissions pode faltar no cache persistido de versões antigas —
    // resolvePermissions cai no padrão do papel nesse caso.
    return resolvePermissions(activeCompany.memberRole, activeCompany.memberPermissions).includes(action);
  };
}
