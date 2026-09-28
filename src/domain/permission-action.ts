/// Espelho de Agent-Api/src/domain/enums/permission-action.ts — mudar um lado
/// exige mudar o outro manualmente (não há geração de tipos compartilhada
/// entre os repositórios).
export enum PermissionAction {
  AGENTS_VIEW = "AGENTS_VIEW",
  AGENTS_WRITE = "AGENTS_WRITE",
  WABAS_VIEW = "WABAS_VIEW",
  WABAS_WRITE = "WABAS_WRITE",
  SERVICE_ISLANDS_VIEW = "SERVICE_ISLANDS_VIEW",
  SERVICE_ISLANDS_WRITE = "SERVICE_ISLANDS_WRITE",
  QUEUES_VIEW = "QUEUES_VIEW",
  QUEUES_WRITE = "QUEUES_WRITE",
  CONTACTS_VIEW = "CONTACTS_VIEW",
  CONTACTS_WRITE = "CONTACTS_WRITE",
  CAMPAIGNS_VIEW = "CAMPAIGNS_VIEW",
  CAMPAIGNS_WRITE = "CAMPAIGNS_WRITE",
  CRM_VIEW = "CRM_VIEW",
  CRM_WRITE = "CRM_WRITE",
  ACCESS_VIEW = "ACCESS_VIEW",
  ACCESS_WRITE = "ACCESS_WRITE",
  REPORTS_VIEW = "REPORTS_VIEW",
  COMPANIES_MANAGE_OWN = "COMPANIES_MANAGE_OWN",
  COMPANIES_MANAGE_ALL = "COMPANIES_MANAGE_ALL",
}

export type MemberRole = "GERENTE" | "SUPERVISOR" | "ATENDENTE";

export const PERMISSION_MATRIX: Record<MemberRole, PermissionAction[]> = {
  ATENDENTE: [PermissionAction.CONTACTS_VIEW],
  SUPERVISOR: [
    PermissionAction.CONTACTS_VIEW,
    PermissionAction.CONTACTS_WRITE,
    PermissionAction.QUEUES_VIEW,
    PermissionAction.QUEUES_WRITE,
    PermissionAction.CAMPAIGNS_VIEW,
    PermissionAction.CAMPAIGNS_WRITE,
    PermissionAction.CRM_VIEW,
    PermissionAction.CRM_WRITE,
    PermissionAction.REPORTS_VIEW,
  ],
  GERENTE: [
    PermissionAction.AGENTS_VIEW,
    PermissionAction.AGENTS_WRITE,
    PermissionAction.WABAS_VIEW,
    PermissionAction.WABAS_WRITE,
    PermissionAction.SERVICE_ISLANDS_VIEW,
    PermissionAction.SERVICE_ISLANDS_WRITE,
    PermissionAction.QUEUES_VIEW,
    PermissionAction.QUEUES_WRITE,
    PermissionAction.CONTACTS_VIEW,
    PermissionAction.CONTACTS_WRITE,
    PermissionAction.CAMPAIGNS_VIEW,
    PermissionAction.CAMPAIGNS_WRITE,
    PermissionAction.CRM_VIEW,
    PermissionAction.CRM_WRITE,
    PermissionAction.ACCESS_VIEW,
    PermissionAction.ACCESS_WRITE,
    PermissionAction.REPORTS_VIEW,
    PermissionAction.COMPANIES_MANAGE_OWN,
  ],
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  GERENTE: "Gerente",
  SUPERVISOR: "Supervisor",
  ATENDENTE: "Atendente",
};

/// Espelho de CONFIGURABLE_PERMISSIONS/resolvePermissions do Agent-Api
/// (application/authorization/permission-matrix.ts). Acessos e gestão de
/// empresas ficam fora: continuam presos ao papel.
export const CONFIGURABLE_PERMISSIONS: PermissionAction[] = [
  PermissionAction.CONTACTS_VIEW,
  PermissionAction.CONTACTS_WRITE,
  PermissionAction.CAMPAIGNS_VIEW,
  PermissionAction.CAMPAIGNS_WRITE,
  PermissionAction.CRM_VIEW,
  PermissionAction.CRM_WRITE,
  PermissionAction.REPORTS_VIEW,
  PermissionAction.AGENTS_VIEW,
  PermissionAction.AGENTS_WRITE,
  PermissionAction.WABAS_VIEW,
  PermissionAction.WABAS_WRITE,
  PermissionAction.SERVICE_ISLANDS_VIEW,
  PermissionAction.SERVICE_ISLANDS_WRITE,
  PermissionAction.QUEUES_VIEW,
  PermissionAction.QUEUES_WRITE,
];

/// Permissões efetivas: sem personalização (null) vale o papel; com
/// personalização, as configuráveis vêm da lista e o resto do papel.
export function resolvePermissions(role: MemberRole, custom: PermissionAction[] | null | undefined): PermissionAction[] {
  const byRole = PERMISSION_MATRIX[role];
  if (!Array.isArray(custom)) return byRole;
  const chosen = custom.filter((action) => CONFIGURABLE_PERMISSIONS.includes(action));
  const fixed = byRole.filter((action) => !CONFIGURABLE_PERMISSIONS.includes(action));
  return [...new Set([...chosen, ...fixed])];
}

/// Linhas da tela de Acessos: cada tela vira um par de checkboxes
/// Acessar (view) / Editar (write). Ilhas levam junto as filas, que são
/// parte da mesma tela.
export interface ScreenPermission {
  label: string;
  view: PermissionAction[];
  write: PermissionAction[];
}

export const SCREEN_PERMISSIONS: ScreenPermission[] = [
  { label: "Contatos", view: [PermissionAction.CONTACTS_VIEW], write: [PermissionAction.CONTACTS_WRITE] },
  { label: "Campanhas", view: [PermissionAction.CAMPAIGNS_VIEW], write: [PermissionAction.CAMPAIGNS_WRITE] },
  { label: "Kanban Board", view: [PermissionAction.CRM_VIEW], write: [PermissionAction.CRM_WRITE] },
  { label: "Métricas", view: [PermissionAction.REPORTS_VIEW], write: [] },
  { label: "Agentes de IA", view: [PermissionAction.AGENTS_VIEW], write: [PermissionAction.AGENTS_WRITE] },
  { label: "Redes Sociais", view: [PermissionAction.WABAS_VIEW], write: [PermissionAction.WABAS_WRITE] },
  {
    label: "Ilhas de Atendimento",
    view: [PermissionAction.SERVICE_ISLANDS_VIEW, PermissionAction.QUEUES_VIEW],
    write: [PermissionAction.SERVICE_ISLANDS_WRITE, PermissionAction.QUEUES_WRITE],
  },
];
