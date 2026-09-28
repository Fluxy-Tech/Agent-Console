import type { MemberRole, PermissionAction } from "../domain/permission-action";

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  status: string | null;
  hasApiAccessToken: boolean;
}

export interface InvitationMember {
  id: string;
  organizationId: string;
  code: string;
  email: string;
  role: MemberRole;
  finish: boolean;
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  organizationId: string;
  userId: string;
  role: MemberRole;
  blocked: boolean;
  /// Telas liberadas por checkbox na tela de Acessos; null = padrão do papel.
  permissions: PermissionAction[] | null;
  createdAt: string;
  user: { id: string; name: string; email: string; image: string | null };
}

export interface Agent {
  id: string;
  organizationId: string;
  name: string;
  isActive: boolean;
  processingMessage: string;
  transferMessage: string;
  unsupportedFormatMessage: string;
  blockedMessage: string;
  outOfHoursMessage: string;
  outOfHoursEnabled: boolean;
  closingMessage: string;
  closingEnabled: boolean;
  errorMessage: string;
  errorEnabled: boolean;
  defaultQueueId: string | null;
  personality: string | null;
  ragEnabled: boolean;
  ragChunkSize: number | null;
  /// 6 primeiros chars do token decifrado, só pra confirmação visual — nunca
  /// o token completo. null quando nenhum token está configurado.
  openaiTokenPreview: string | null;
  geminiTokenPreview: string | null;
  /// Soft delete — null = ativo. Excluído nunca aparece na lista de agentes
  /// nem no vínculo de Redes sociais, mas ainda pode aparecer em filtros
  /// (Contatos/Campanhas, via ?includeDeleted=true) e telas de informação.
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RagDocumentStatus = "PROCESSING" | "READY" | "FAILED";

export interface RagDocument {
  id: string;
  agentId: string;
  fileName: string;
  categories: string[];
  chunkSize: number;
  status: RagDocumentStatus;
  chunkCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Channel {
  id: string;
  organizationId: string;
  /// Opcional: um canal pode não ter nenhum agente de IA vinculado (só
  /// atendimento humano).
  agentId: string | null;
  /// Se true, mensagens deste canal vão pro agente de IA (agentId). Se
  /// false, vão direto pro atendimento humano na fila idServiceIslandDefault.
  openAgent: boolean;
  /// Apesar do nome, é o id de uma Queue (fila) — a fila que recebe o
  /// atendimento quando openAgent=false.
  idServiceIslandDefault: string | null;
  phoneNumberId: string;
  displayNumber: string;
  wabaId: string;
  /// 3 primeiros + 3 últimos caracteres do token, com asteriscos fixos no
  /// meio (ex: "AAA************BBB") — null quando nenhum token configurado.
  metaAccessTokenPreview: string | null;
  /// Palavras/frases-chave de reset de jornada: quando o contato manda uma
  /// mensagem igual a uma delas, o worker apaga o histórico de sessão e os
  /// metadados salvos do contato em vez de responder normalmente.
  wordsToReset: string[];
  /// Mensagem enviada ao contato depois do reset de jornada. null = usa a
  /// mensagem padrão fixa no Piloto.
  resetMessage: string | null;
  /// Frases que, quando um contato responde a um disparo de campanha deste
  /// canal com uma delas, bloqueiam o contato de futuras campanhas NESTE
  /// canal. Só avaliado quando useWordsToBlockCampaign=true.
  wordsToBlockCampaign: string[];
  useWordsToBlockCampaign: boolean;
  createdAt: string;
  updatedAt: string;
  serviceIsland?: ServiceIsland | null;
  agent?: Agent | null;
}

export interface ChannelStatus {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  status?: string;
  quality_rating?: string;
  name_status?: string;
  code_verification_status?: string;
  messaging_limit_tier?: string;
  throughput?: { level?: string };
}

/// Primeiro ano disponível no filtro dos gráficos "Fluxo de
/// conversas"/"Fluxo de mensagens" — nunca existe dado de antes disso.
export const MIN_SERIES_YEAR = 2024;

/// Período dos gráficos — um ano específico (granularidade mensal,
/// date = "YYYY-MM") ou "current-month" (granularidade diária,
/// date = "YYYY-MM-DD"; só o gráfico de mensagens oferece essa opção).
export type SeriesPeriod = "current-month" | number;

export interface ConversationsSeries {
  period: SeriesPeriod;
  granularity: "day" | "month";
  points: { date: string; count: number }[];
}

export interface MessagesSeries {
  period: SeriesPeriod;
  granularity: "day" | "month";
  points: { date: string; sent: number; received: number }[];
}

export interface ChannelCampaignReport {
  totalMessages: number;
  byCategory: { category: string | null; campaignCount: number; messagesSent: number }[];
}

export interface TicketCloseTag {
  id: string;
  serviceIslandId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceIsland {
  id: string;
  organizationId: string;
  whatsappChannelId: string;
  name: string;
  requireCloseTag: boolean;
  allowActiveDispatch: boolean;
  allowAudioMessages: boolean;
  useAttendantSignature: boolean;
  allowAttendantCarteira: boolean;
  createdAt: string;
  updatedAt: string;
  whatsappChannel?: Channel;
  queues?: Queue[];
  closeTags?: TicketCloseTag[];
}

export interface QueueMember {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string };
}

export interface Queue {
  id: string;
  serviceIslandId: string;
  name: string;
  isActive: boolean;
  businessHoursEnabled: boolean;
  businessHoursStart: string | null;
  businessHoursEnd: string | null;
  businessDays: number[];
  /// true só na fila "Default" criada automaticamente com a ilha — nunca
  /// pode ser excluída (ver Agent-Api/queue-service.ts).
  isDefault: boolean;
  /// Fila liberada pra ser destino de Carteira de atendimento.
  carteiraEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  // Só vem preenchido em endpoints que fazem include explícito dos membros
  // (ex: GET /api/service-islands/:id) — tratar sempre como potencialmente
  // ausente.
  members?: QueueMember[];
}

/// Carteira de atendimento — GET /api/service-islands/:id/carteiras.
export interface Carteira {
  id: string;
  name: string;
  queueId: string;
  queue: { id: string; name: string; carteiraEnabled: boolean };
  targetCount: number;
  createdAt: string;
}

/// GET /api/targets/:id/carteiras — todas as carteiras da empresa, com
/// `checked` = o contato já está nela.
export interface TargetCarteira {
  id: string;
  name: string;
  checked: boolean;
  queue: { id: string; name: string; serviceIsland: { id: string; name: string } };
}

export type TargetStatus = "AI" | "HUMAN" | "FINISHED";

export interface TicketSummary {
  id: string;
  ticketNumber: number;
  status: "WAITING" | "IN_PROGRESS" | "CLOSED";
  queue: { name: string; serviceIsland: { id: string; name: string } };
  assignedUser: { id: string; name: string; email: string } | null;
  createdAt: string;
  closedAt: string | null;
}

export interface Target {
  id: string;
  organizationId: string;
  whatsappChannelId: string;
  /// Business-Scoped User ID (vínculo principal do contato desde abr/2026) —
  /// null só quando o contato ainda não mandou mensagem de verdade pelo
  /// WhatsApp (ex: cadastro manual).
  bsuid: string | null;
  /// Telefone — a Meta pode omitir quando o contato ativa @username e não
  /// há troca recente de telefone.
  waId: string | null;
  name: string | null;
  email: string | null;
  metadata: Record<string, unknown> | null;
  status: TargetStatus;
  firstInteractionAt: string;
  lastInteractionAt: string | null;
  blockedAgentIds: string[];
  whatsappChannel?: Channel & { agent: Agent };
  tickets?: TicketSummary[];
  /// Presente só no detalhe do contato; null = ainda não tem card no CRM.
  cardCrm?: { id: string } | null;
}

export interface CrmCardTarget {
  id: string;
  name: string | null;
  waId: string | null;
  email: string | null;
  status: TargetStatus;
  lastInteractionAt: string | null;
}

export type CardPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const CARD_PRIORITY_LABELS: Record<CardPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export interface CrmCard {
  id: string;
  stagesCrmId: string | null;
  statusPriority: CardPriority;
  updatedAt: string;
  /// Chaves S3 dos anexos — o card do Kanban só usa a quantidade.
  attachments: string[];
  _count: { comments: number };
  target: CrmCardTarget;
}

export interface CrmCardComment {
  id: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string };
}

export interface CrmCardAttachment {
  s3Key: string;
  fileName: string;
  /// URL presignada de leitura (expira em 1h) — gerada a cada GET do card.
  url: string;
}

/// Resposta de GET /api/crm/cards/:id — tudo do Drawer "Detalhes do lead".
export interface CrmCardDetail {
  id: string;
  stagesCrmId: string | null;
  statusPriority: CardPriority;
  target: Target;
  stages: { id: string; nameStage: string; position: number }[];
  comments: CrmCardComment[];
  attachments: CrmCardAttachment[];
}

export interface CrmStage {
  id: string;
  nameStage: string;
  position: number;
  isDefault: boolean;
  cards: CrmCard[];
}

/// Etapa do funil de conversões — olha pra chave `name` do Target.metadata.
/// useValue=false: basta a chave estar preenchida; true: precisa ser igual a
/// `value` (sem diferenciar maiúsculas/minúsculas).
export interface CrmFunnelField {
  id: string;
  name: string;
  value: string | null;
  useValue: boolean;
}

/// Resposta de GET /api/crm/funnel.
export interface CrmFunnel {
  id: string;
  totalTargets: number;
  fields: (CrmFunnelField & { count: number })[];
}

/// Resposta de GET /api/crm/funnel/fields/:id/targets (lista cortada em 200,
/// `total` é a contagem real).
export interface CrmFunnelFieldTargets {
  field: CrmFunnelField;
  total: number;
  items: { id: string; name: string | null; waId: string | null; email: string | null; metadataValue: string | null }[];
}

/// Situação final de um evento do calendário — null = ainda agendado.
export type EventStatus = "FINISHED" | "RESCHEDULED" | "CANCELED";

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  FINISHED: "Finalizado",
  RESCHEDULED: "Remarcado",
  CANCELED: "Cancelado",
};

export interface CalendarEventTarget {
  id: string;
  name: string | null;
  waId: string | null;
  email: string | null;
}

/// Item de GET /api/crm/calendar/events (grade do calendário).
export interface CalendarEventSummary {
  id: string;
  name: string;
  dateEvent: string;
  status: EventStatus | null;
  isClosed: boolean;
  target: CalendarEventTarget;
}

export interface CalendarEventAnnotation {
  id: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string };
}

/// GET /api/crm/calendar/events/:id — tudo do modal do evento.
export interface CalendarEventDetail extends CalendarEventSummary {
  description: string | null;
  targetId: string;
  createdAt: string;
  updatedAt: string;
  annotations: CalendarEventAnnotation[];
  documents: { s3Key: string; fileName: string; url: string }[];
}

export type TicketCloseReason = "RESOLVED" | "TRANSFERRED_QUEUE" | "TRANSFERRED_AGENT" | "SESSION_EXPIRED" | "ABANDONED";

export interface IslandTicket {
  id: string;
  ticketNumber: number;
  status: "WAITING" | "IN_PROGRESS" | "CLOSED";
  closeReason: TicketCloseReason | null;
  target: { id: string; name: string | null; waId: string | null };
  queue: { id: string; name: string };
  assignedUser: { id: string; name: string; email: string } | null;
  closeTag: { id: string; name: string } | null;
  createdAt: string;
  assignedAt: string | null;
  closedAt: string | null;
  waitDurationMs: number | null;
  handlingDurationMs: number | null;
}

export interface IslandTicketListResult {
  items: IslandTicket[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueueListResult {
  items: Queue[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueueStats {
  total: number;
  active: number;
  inactive: number;
}

export interface TicketCloseTagListResult {
  items: TicketCloseTag[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PreConfiguredMessage {
  id: string;
  serviceIslandId: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  queues: { id: string; name: string }[];
}

export interface PreConfiguredMessageListResult {
  items: PreConfiguredMessage[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AttendantSummary {
  userId: string;
  name: string;
  email: string;
  queueName: string;
  status: "ONLINE" | "PAUSED" | "OFFLINE";
  statusUpdatedAt: string | null;
  ticketCount: number;
}

export interface IslandMonitoring {
  queues: { queueId: string; queueName: string; waitingCount: number; inProgressCount: number }[];
  attendants: { online: number; paused: number; offline: number; total: number; list: AttendantSummary[] };
  waitingTickets: IslandTicket[];
  inProgressTickets: IslandTicket[];
}

export interface TicketHistoryStats {
  total: number;
  concluded: number;
  canceled: number;
  inProgress: number;
}

export interface TicketDetail {
  id: string;
  ticketNumber: number;
  status: "WAITING" | "IN_PROGRESS" | "CLOSED";
  closeReason: TicketCloseReason | null;
  target: { id: string; name: string | null; waId: string | null; email: string | null; metadata: Record<string, unknown> | null };
  queue: { id: string; name: string };
  assignedUser: { id: string; name: string; email: string } | null;
  closeTag: { id: string; name: string } | null;
  createdAt: string;
  assignedAt: string | null;
  closedAt: string | null;
  waitDurationMs: number | null;
  handlingDurationMs: number | null;
  messagingSession: { id: string; lastCustomerMessageAt: string };
  history: MessageDocument[];
}

export interface TargetListResult {
  items: Target[];
  total: number;
  page: number;
  pageSize: number;
}

export type MessageType = "TEXT" | "AUDIO" | "IMAGE" | "DOCUMENT" | "STICKER" | "VIDEO";

export interface MessageDocument {
  _id: string;
  direction: "INBOUND" | "OUTBOUND";
  senderType: "CUSTOMER" | "AGENT_AI" | "ATTENDANT" | "SYSTEM" | "CAMPAIGN";
  messageType: MessageType;
  text?: string;
  mediaUrl?: string;
  campaignId?: string;
  templateName?: string;
  createdAt: string;
}

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string;
  text?: string;
  buttons?: { type: string; text: string }[];
}

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: string;
  components: TemplateComponent[];
  variableCount: { header: number; body: number };
}

export type CampaignStatus = "PROCESSING" | "COMPLETED";
export type CampaignDispatchType = "CSV" | "MANUAL";

export interface CampaignListItem {
  id: string;
  name: string;
  category: TemplateCategory | null;
  templateName: string;
  status: CampaignStatus;
  dispatchType: CampaignDispatchType;
  expectedContacts: number;
  totalContacts: number;
  totalSent: number;
  totalFailures: number;
  whatsappChannelId: string;
  whatsappChannelDisplayNumber: string;
  agentId: string;
  agentName: string;
  createdByName: string | null;
  createdByEmail: string | null;
  sentAt: string;
}

export interface CampaignTargetItem {
  id: string;
  targetId: string;
  targetName: string | null;
  targetPhone: string | null;
  status: string;
  messageId: string | null;
  variables: { header?: { text: string }[]; body?: { text: string }[]; button?: { text: string }[] } | null;
  createdAt: string;
}

export interface CampaignStats {
  totalCampaigns: number;
  completedCampaigns: number;
  totalMessagesSent: number;
  totalFailures: number;
  uniqueContacts: number;
}

export interface CampaignFilterOptions {
  templates: string[];
}

export interface TargetStats {
  total: number;
  blocked: number;
  interactionsToday: number;
  /// Contatos distintos (não mensagens) com pelo menos uma interação nas
  /// últimas 24h — diferente de interactionsToday, que soma cada mensagem.
  contactsInteractedToday: number;
  lastInteractionAt: string | null;
  primaryAgentName: string | null;
}

export interface QueueMetric {
  queueId: string;
  queueName: string;
  serviceIslandName: string;
  ticketCount: number;
  avgHandlingMs: number | null;
}

export interface ChannelGrowth {
  channelId: string;
  displayNumber: string;
  agentName: string | null;
  currentPeriodContacts: number;
  previousPeriodContacts: number;
  growthPercent: number | null;
}

export interface TopAttendant {
  userId: string;
  name: string;
  email: string;
  closedTicketCount: number;
}

export interface CampaignMetrics {
  totalCampaigns: number;
  reachedContacts: number;
  /// Total de contatos já processados em todas as campanhas (enviados com
  /// sucesso + falhas) — o "de X" da fração de contatos alcançados.
  totalContacts: number;
  totalFailures: number;
  /// alcançados - totalContacts. Sempre <= 0; quanto mais perto de 0, melhor
  /// a entrega das campanhas (menos falha de envio).
  reachDelta: number;
  respondedDispatches: number;
  responseRate: number | null;
  /// Segunda a Domingo, nessa ordem — quantos disparos alcançaram o contato
  /// naquele dia da semana e quantos desses já têm resposta do cliente
  /// vinculada (CampaignTarget.respondedCampaign).
  responsesByWeekday: { weekday: string; total: number; responded: number; responseRate: number | null }[];
}

export interface ReportOverview {
  contactsByStatus: { withAgent: number; withHuman: number };
  avgConversationDuration: { avgDurationMs: number | null; sampleSize: number };
  queueMetrics: { mostInteractions: QueueMetric | null; slowest: QueueMetric | null; fastest: QueueMetric | null };
  channelCount: number;
  topChannelsByGrowth: ChannelGrowth[];
  topAttendantsByClosedTickets: TopAttendant[];
  campaignMetrics: CampaignMetrics;
}

export interface CampaignDetail extends CampaignListItem {
  targets: CampaignTargetItem[];
}

export interface CampaignListResult {
  items: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
}
