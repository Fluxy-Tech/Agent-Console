import {
  CalendarClock,
  GalleryHorizontal,
  Images,
  Link2,
  List,
  MapPin,
  MessageSquareQuote,
  MessagesSquare,
  MousePointerClick,
  ShoppingBag,
  SquareKanban,
  SquareMousePointer,
  type LucideIcon,
} from "lucide-react";
import type { AgentFeatureType, AgentFunctionType } from "@/types/domain";

/// Tudo o que aparece em "Adicionar funcionalidade". Três origens no back:
/// - "function": AgentFunction (agendamento/Kanban), uma por agente;
/// - "rgbs": colunas do próprio agente, uma por agente;
/// - "feature": AgentFeature, várias por agente (exceto `single`).
export type FeatureKey = AgentFeatureType | AgentFunctionType | "RGBS";

export interface FeatureInfo {
  key: FeatureKey;
  kind: "function" | "rgbs" | "feature";
  title: string;
  description: string;
  icon: LucideIcon;
  group: "Funções" | "Mensagens interativas" | "Catálogo" | "Recursos de mensagem";
  /// Só uma por agente.
  single?: boolean;
}

export const FEATURES: FeatureInfo[] = [
  {
    key: "CALENDAR_EVENT",
    kind: "function",
    title: "Agendamento de evento",
    description: "Pergunta dia e horário, confere a agenda dos usuários liberados e agenda o evento.",
    icon: CalendarClock,
    group: "Funções",
    single: true,
  },
  {
    key: "KANBAN_CARD",
    kind: "function",
    title: "Card no Kanban",
    description: "Cria o card do contato no Kanban com os dados coletados.",
    icon: SquareKanban,
    group: "Funções",
    single: true,
  },
  {
    key: "CTA_URL",
    kind: "feature",
    title: "Botão de link",
    description: "Mensagem com um botão que abre um link.",
    icon: SquareMousePointer,
    group: "Mensagens interativas",
  },
  {
    key: "LIST",
    kind: "feature",
    title: "Lista de opções",
    description: "Menu com até 10 opções para o contato escolher.",
    icon: List,
    group: "Mensagens interativas",
  },
  {
    key: "REPLY_BUTTONS",
    kind: "feature",
    title: "Botões de resposta",
    description: "Até 3 botões de resposta rápida, fixos ou criados pela IA.",
    icon: MousePointerClick,
    group: "Mensagens interativas",
  },
  {
    key: "MEDIA_CAROUSEL",
    kind: "feature",
    title: "Carrossel de mídia",
    description: "De 2 a 10 cards com imagem ou vídeo e botão de link.",
    icon: Images,
    group: "Mensagens interativas",
  },
  {
    key: "LOCATION_REQUEST",
    kind: "feature",
    title: "Solicitar localização",
    description: 'Pede a localização do contato e salva no metadado "localization".',
    icon: MapPin,
    group: "Mensagens interativas",
    single: true,
  },
  {
    key: "CATALOG",
    kind: "feature",
    title: "Catálogo",
    description: "Envia o catálogo da Meta inteiro ou produtos escolhidos.",
    icon: ShoppingBag,
    group: "Catálogo",
  },
  {
    key: "PRODUCT_CAROUSEL",
    kind: "feature",
    title: "Carrossel de produtos",
    description: "De 2 a 10 produtos do catálogo em cards lado a lado.",
    icon: GalleryHorizontal,
    group: "Catálogo",
  },
  {
    key: "CONTEXTUAL_REPLY",
    kind: "feature",
    title: "Respostas contextuais",
    description: "O agente responde citando a mensagem do contato a que se refere.",
    icon: MessageSquareQuote,
    group: "Recursos de mensagem",
    single: true,
  },
  {
    key: "LINK_PREVIEW",
    kind: "feature",
    title: "Prévia de link",
    description: "Envia um link com a prévia do site (título e imagem).",
    icon: Link2,
    group: "Recursos de mensagem",
  },
  {
    key: "RGBS",
    kind: "rgbs",
    title: "RGBS",
    description: "Divide a resposta em mensagens curtas, com espera entre elas.",
    icon: MessagesSquare,
    group: "Recursos de mensagem",
    single: true,
  },
];

export const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f])) as Record<FeatureKey, FeatureInfo>;

export const FEATURE_GROUPS: FeatureInfo["group"][] = [
  "Funções",
  "Mensagens interativas",
  "Catálogo",
  "Recursos de mensagem",
];

/// Limites da Meta — os mesmos validados no Agent-Api.
export const LIMITS = {
  buttonText: 20,
  headerText: 60,
  footerText: 60,
  sectionTitle: 24,
  rowTitle: 24,
  rowDescription: 72,
  listRows: 10,
  replyButtons: 3,
  carouselMin: 2,
  carouselMax: 10,
  cardBody: 160,
  prompt: 1000,
} as const;
