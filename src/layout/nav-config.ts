import { BarChart3, Bot, Headset, KeyRound, LandPlot, Megaphone, MessageSquareText, Users, Waypoints } from "lucide-react";
import { PermissionAction } from "@/domain/permission-action";

export interface NavItem {
  label: string;
  to: string;
  icon: typeof Bot;
  action: PermissionAction;
  /// Link pra fora do console (abre em nova aba), ex.: o Fluxy Desk.
  external?: boolean;
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
    label: "Configurações",
    items: [{ label: "Acessos", to: "/access", icon: KeyRound, action: PermissionAction.ACCESS_VIEW }],
  },
];
