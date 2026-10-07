import { BarChart3, Bot, Headset, LandPlot, LayoutDashboard, LifeBuoy, Ticket, UsersRound, Megaphone, MessageSquareText, Settings, Users, Waypoints } from "lucide-react";
import { PermissionAction } from "@/domain/permission-action";

export interface NavItem {
  label: string;
  to: string;
  icon: typeof Bot;
  /// Omitir = todo usuário com empresa ativa vê (ex.: Configurações, onde
  /// cada um edita ao menos o próprio perfil).
  action?: PermissionAction;
  /// Link pra fora do console (abre em nova aba), ex.: o Fluxy Desk.
  external?: boolean;
  /// Contador ao lado do item — "support" = chamados com mensagem não lida.
  badge?: "support";
  /// Restrição extra além de `action`: "platformAdmin" = só Administrador;
  /// "supportTeam" = Administrador ou flag de suporte (quem atende tickets);
  /// "customer" = quem NÃO é do time de suporte (as empresas).
  audience?: "platformAdmin" | "supportTeam" | "customer";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operações",
    items: [
      { label: "Contatos", to: "/targets", icon: Users, action: PermissionAction.CONTACTS_VIEW },
      { label: "Campanhas", to: "/campaigns", icon: Megaphone, action: PermissionAction.CAMPAIGNS_VIEW },
      { label: "Kanban Board", to: "/crm", icon: LandPlot, action: PermissionAction.CRM_VIEW },
    ],
  },
  {
    label: "Configurações para WhatsApp",
    items: [
      { label: "Métricas", to: "/reports", icon: BarChart3, action: PermissionAction.REPORTS_VIEW },
      { label: "Agentes de IA", to: "/agents", icon: Bot, action: PermissionAction.AGENTS_VIEW },
      { label: "Redes Sociais", to: "/channels", icon: MessageSquareText, action: PermissionAction.WABAS_VIEW },
      { label: "Ilhas de Atendimento", to: "/service-island", icon: Waypoints, action: PermissionAction.SERVICE_ISLANDS_VIEW },
    ],
  },
  {
    label: "Configurações",
    items: [
      // Meu perfil (todos) + Empresa e Acessos (Gerente/Administrador).
      { label: "Configurações", to: "/settings", icon: Settings },
      // Área das empresas (abrir e acompanhar tickets). Quem atende usa o
      // grupo "Suporte técnico" abaixo, com telas próprias.
      {
        label: "Suporte técnico",
        to: "/technical-support",
        icon: LifeBuoy,
        action: PermissionAction.SUPPORT_VIEW,
        audience: "customer",
        badge: "support",
      },
    ],
  },
  {
    label: "Links externos",
    items: [
      {
        label: "Acessar o desk",
        to: "https://desk.sturnusflow.com.br",
        icon: Headset,
        action: PermissionAction.SERVICE_ISLANDS_VIEW,
        external: true,
      },
    ],
  },
  {
    label: "Suporte técnico",
    items: [
      {
        label: "Dashboard",
        to: "/support/dashboard",
        icon: LayoutDashboard,
        action: PermissionAction.SUPPORT_VIEW,
        audience: "supportTeam",
      },
      {
        label: "Tickets",
        to: "/support",
        icon: Ticket,
        action: PermissionAction.SUPPORT_VIEW,
        audience: "supportTeam",
        badge: "support",
      },
      {
        label: "Time de suporte",
        to: "/support/team",
        icon: UsersRound,
        action: PermissionAction.SUPPORT_VIEW,
        audience: "platformAdmin",
      },
    ],
  },
];
