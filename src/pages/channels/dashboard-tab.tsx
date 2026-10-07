import { useState } from "react";
import useSWR from "swr";
import {
  BadgeCheck,
  BadgeX,
  Gauge,
  MessagesCircle,
  Send,
  ShieldCheck,
  ShieldX,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
  Tag,
  TrendingUp,
  Wallet,
  Wifi,
  WifiHigh,
  WifiLow,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { type DateRange } from "@/components/calendar";
import { DateRangePicker } from "@/components/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TemplateCategory, ChannelCampaignReport, ChannelStatus } from "@/types/domain";
import { ConversationsFlowChart } from "./conversations-flow-chart";
import { MessagesFlowChart } from "./messages-flow-chart";

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  MARKETING: "Disparo de Marketing",
  UTILITY: "Disparos de Utilidade",
  AUTHENTICATION: "Autenticação",
};

/// Categorias sempre exibidas no card "Gastos", mesmo sem nenhum disparo no
/// período — entram com 0 pra não sumir a linha. Outras categorias que
/// aparecerem no relatório (ex: Autenticação) continuam sendo mostradas,
/// só não têm uma linha "fantasma" quando vazias.
const ALWAYS_VISIBLE_CATEGORIES: TemplateCategory[] = ["MARKETING", "UTILITY"];

function mergeCampaignCategories(
  byCategory: ChannelCampaignReport["byCategory"],
): ChannelCampaignReport["byCategory"] {
  const rows = new Map(byCategory.map((row) => [row.category, row]));
  for (const category of ALWAYS_VISIBLE_CATEGORIES) {
    if (!rows.has(category)) rows.set(category, { category, campaignCount: 0, messagesSent: 0 });
  }
  return ALWAYS_VISIBLE_CATEGORIES.map((category) => rows.get(category)!).concat(
    byCategory.filter((row) => !ALWAYS_VISIBLE_CATEGORIES.includes(row.category as TemplateCategory)),
  );
}

function categoryLabel(category: string | null): string {
  if (!category) return "Sem categoria";
  return CATEGORY_LABEL[category as TemplateCategory] ?? category;
}

type StatusSeverity = "success" | "warning" | "destructive" | "neutral";

const GOOD_STATUSES = new Set(["CONNECTED", "GREEN", "VERIFIED", "APPROVED", "AVAILABLE_WITHOUT_REVIEW"]);
const BAD_STATUSES = new Set(["RED", "FLAGGED", "RESTRICTED", "RATE_LIMITED", "BANNED", "DECLINED", "EXPIRED"]);
const WARN_STATUSES = new Set(["YELLOW", "PENDING", "PENDING_REVIEW", "NOT_VERIFIED"]);

function statusSeverity(value?: string): StatusSeverity {
  if (!value) return "neutral";
  if (GOOD_STATUSES.has(value)) return "success";
  if (BAD_STATUSES.has(value)) return "destructive";
  if (WARN_STATUSES.has(value)) return "warning";
  return "neutral";
}

const SEVERITY_ICON_CLASS: Record<StatusSeverity, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

const SEVERITY_TEXT_CLASS: Record<StatusSeverity, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  neutral: "text-foreground",
};

/// Valores brutos que a Graph API da Meta devolve pros campos de status do
/// número — sempre em inglês. Um único dicionário cobre todos os campos: os
/// valores não colidem em significado entre eles (ex: EXPIRED sempre quer
/// dizer "expirado", não importa em qual campo apareça).
const STATUS_VALUE_LABEL: Record<string, string> = {
  CONNECTED: "Conectado",
  PENDING: "Pendente",
  FLAGGED: "Sinalizado",
  RESTRICTED: "Restrito",
  RATE_LIMITED: "Taxa limitada",
  BANNED: "Banido",
  DELETED: "Excluído",
  MIGRATED: "Migrado",
  UNKNOWN: "Desconhecido",
  UNVERIFIED: "Não verificado",
  GREEN: "Alta",
  YELLOW: "Média",
  RED: "Baixa",
  NA: "Não disponível",
  APPROVED: "Aprovado",
  AVAILABLE_WITHOUT_REVIEW: "Disponível sem revisão",
  DECLINED: "Recusado",
  EXPIRED: "Expirado",
  PENDING_REVIEW: "Em revisão",
  NONE: "Nenhum",
  VERIFIED: "Verificado",
  NOT_VERIFIED: "Não verificado",
  TIER_50: "Até 50 conversas/dia",
  TIER_250: "Até 250 conversas/dia",
  TIER_1K: "Até 1 mil conversas/dia",
  TIER_10K: "Até 10 mil conversas/dia",
  TIER_100K: "Até 100 mil conversas/dia",
  TIER_UNLIMITED: "Ilimitado",
  STANDARD: "Padrão",
  HIGH: "Alta",
};

function translateStatusValue(value: string): string {
  return STATUS_VALUE_LABEL[value] ?? value.replaceAll("_", " ");
}

const CONNECTION_STATUS_ICON: Record<string, LucideIcon> = {
  CONNECTED: Wifi,
  PENDING: WifiHigh,
  RATE_LIMITED: WifiLow,
  FLAGGED: WifiLow,
  BANNED: WifiOff,
};

function connectionStatusIcon(value: string): LucideIcon {
  return CONNECTION_STATUS_ICON[value] ?? Wifi;
}

const QUALITY_ICON: Record<string, LucideIcon> = {
  GREEN: SignalHigh,
  YELLOW: SignalMedium,
  RED: SignalLow,
  NA: SignalZero,
};

function qualityIcon(value: string): LucideIcon {
  return QUALITY_ICON[value] ?? Gauge;
}

function verificationIcon(value: string): LucideIcon {
  return value === "EXPIRED" ? ShieldX : ShieldCheck;
}

function nameStatusIcon(value: string): LucideIcon {
  return value === "DECLINED" ? BadgeX : BadgeCheck;
}

const FIELD_ICON_RESOLVER: Record<string, (value: string) => LucideIcon> = {
  status: connectionStatusIcon,
  quality_rating: qualityIcon,
  name_status: nameStatusIcon,
  code_verification_status: verificationIcon,
};

const STATUS_FIELD_META: Record<string, { label: string; icon: LucideIcon }> = {
  status: { label: "Status da conexão", icon: Wifi },
  quality_rating: { label: "Qualidade", icon: Gauge },
  name_status: { label: "Nome do perfil", icon: BadgeCheck },
  code_verification_status: { label: "Verificação do número", icon: ShieldCheck },
  messaging_limit_tier: { label: "Limite de envio", icon: Send },
};

function StatusTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  const severity = statusSeverity(value);
  return (
    <div className="bg-card flex items-center gap-3 rounded-xl p-4 shadow-xl">
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-sm", SEVERITY_ICON_CLASS[severity])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={cn("truncate text-base font-semibold", SEVERITY_TEXT_CLASS[severity])}>
          {translateStatusValue(value)}
        </p>
      </div>
    </div>
  );
}

function WhatsappUsageTile({ icon: Icon, value }: { icon: LucideIcon; value: number }) {
  return (
    <div className="bg-primary/5 border-border flex items-start gap-3 rounded-xl border p-4 shadow-xl">
      <div className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">Uso do WhatsApp</p>
        <p className="text-foreground text-2xl font-semibold">{value} mensagens</p>
      </div>
    </div>
  );
}

function CampaignCountRow({ icon: Icon, label, count }: { icon: LucideIcon; label: string; count: number }) {
  return (
    <div className="border-border flex items-center gap-3 rounded-xl border p-3 shadow-xl">
      <div className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{count} {count === 1 ? "mensagem" : "mensagens"}</p>
      </div>
    </div>
  );
}

function CategoryConsumption({ byCategory }: { byCategory: ChannelCampaignReport["byCategory"] }) {
  const total = byCategory.reduce((sum, row) => sum + row.messagesSent, 0);
  return (
    <div className="border-border rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm">
          <TrendingUp className="size-4" />
        </div>
        <p className="text-sm font-medium">Consumo por categoria</p>
      </div>
      <div className="flex flex-col gap-3">
        {byCategory.map((row) => {
          const pct = total > 0 ? Math.round((row.messagesSent / total) * 100) : 0;
          return (
            <div key={row.category ?? "none"} className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground w-28 shrink-0 truncate">{categoryLabel(row.category)}</span>
              <div className="bg-muted h-2 flex-1 overflow-hidden rounded-sm">
                <div className="bg-primary h-full rounded-sm" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right font-medium">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardTitleWithDescription({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-5" />
      </div>
      <div>
        <CardTitle>{title}</CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        {children}
      </div>
    </div>
  );
}

interface DashboardTabProps {
  channelId: string;
  hasMetaAccessToken: boolean;
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function DashboardTab({ channelId, hasMetaAccessToken }: DashboardTabProps) {
  const { data: status, error: statusError } = useSWR<ChannelStatus>(
    hasMetaAccessToken ? `/api/channels/${channelId}/status` : null,
  );

  /// Período do card "Gastos" — começa no mês atual, mas o usuário pode
  /// trocar pelo DateRangePicker (bate no mesmo endpoint com
  /// startDate/endDate em vez do histórico completo).
  const [gastosRange, setGastosRange] = useState<DateRange>({ from: startOfCurrentMonth(), to: new Date() });
  const gastosQuery =
    gastosRange.from && gastosRange.to
      ? `?startDate=${gastosRange.from.toISOString()}&endDate=${gastosRange.to.toISOString()}`
      : "";
  const { data: campaignReport } = useSWR<ChannelCampaignReport>(
    `/api/channels/${channelId}/campaigns-report${gastosQuery}`,
  );

  return (
    <div className="flex flex-col gap-6">
      {hasMetaAccessToken && (
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitleWithDescription
              icon={ShieldCheck}
              title="Status do número na Meta"
              description="Conexão, qualidade, verificação do nome e limite de envio, consultados diretamente na Meta."
            >
              {status && (
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {status.verified_name && (
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Nome:</dt>
                      <dd className="font-medium">{status.verified_name}</dd>
                    </div>
                  )}
                  {status.throughput?.level && (
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Capacidade de disparos ativos:</dt>
                      <dd className="font-medium">{translateStatusValue(status.throughput.level)}</dd>
                    </div>
                  )}
                </dl>
              )}
            </CardTitleWithDescription>
          </CardHeader>
          <CardContent>
            {!status && !statusError && <p className="text-muted-foreground text-sm">Consultando a Meta…</p>}
            {statusError && (
              <p className="text-destructive text-sm">
                {statusError instanceof ApiError ? statusError.message : "Não foi possível consultar o status."}
              </p>
            )}
            {status && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(STATUS_FIELD_META).map(([field, meta]) => {
                  const value = status[field as keyof ChannelStatus] as string | undefined;
                  if (!value) return null;
                  const icon = FIELD_ICON_RESOLVER[field]?.(value) ?? meta.icon;
                  return <StatusTile key={field} icon={icon} label={meta.label} value={value} />;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-xl">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <CardTitleWithDescription
            icon={Wallet}
            title="Volumetria do canal"
            description="Volumetria de mensagens trocadas no período selecionado e mensagens de campanha enviadas por categoria de template."
          />
          <DateRangePicker value={gastosRange} onChange={setGastosRange} className="sm:w-[260px]" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <WhatsappUsageTile icon={MessagesCircle} value={campaignReport?.totalMessages ?? 0} />

            <div className="flex flex-col gap-3">
              {mergeCampaignCategories(campaignReport?.byCategory ?? []).map((row) => (
                <CampaignCountRow
                  key={row.category ?? "none"}
                  icon={row.category === "MARKETING" ? Send : Tag}
                  label={categoryLabel(row.category)}
                  count={row.messagesSent}
                />
              ))}
            </div>

            <CategoryConsumption byCategory={mergeCampaignCategories(campaignReport?.byCategory ?? [])} />
          </div>
        </CardContent>
      </Card>

      <ConversationsFlowChart channelId={channelId} />
      <MessagesFlowChart channelId={channelId} />
    </div>
  );
}
