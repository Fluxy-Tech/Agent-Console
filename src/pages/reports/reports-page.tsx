import { useState } from "react";
import useSWR from "swr";
import {
  Award,
  BarChart3,
  Bot,
  Clock,
  Headset,
  ListChecks,
  Megaphone,
  Radio,
  Trophy,
  TrendingDown,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MetricCard } from "@/components/metric-card";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Channel, ChannelGrowth, QueueMetric, ReportOverview, TopAttendant } from "@/types/domain";
import { ResponseRateCard } from "./response-rate-card";
import { ResponsesByWeekdayCard } from "./responses-by-weekday-card";

const ALL_CHANNELS = "all";

export function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return "< 1 min";

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}min`);

  return parts.join(" ") || "< 1 min";
}

function formatGrowth(growthPercent: number | null): string {
  if (growthPercent === null) return "Novo";
  const sign = growthPercent > 0 ? "+" : "";
  return `${sign}${growthPercent.toFixed(0)}%`;
}

function growthDotClassName(growthPercent: number | null): string {
  if (growthPercent === null || growthPercent > 0) return "bg-success";
  if (growthPercent === 0) return "bg-muted-foreground";
  return "bg-destructive";
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(0)}%`;
}

function QueueMetricCard({
  icon: Icon,
  iconClassName,
  label,
  metric,
  valueKind,
}: {
  icon: typeof BarChart3;
  iconClassName: string;
  label: string;
  metric: QueueMetric | null | undefined;
  valueKind: "count" | "duration";
}) {
  const value = !metric ? "—" : valueKind === "count" ? formatNumber(metric.ticketCount) : formatDuration(metric.avgHandlingMs);
  const sublabel = metric ? `${metric.queueName} · ${metric.serviceIslandName}` : "Sem dados ainda";

  return <MetricCard icon={Icon} iconClassName={iconClassName} label={label} value={value} sublabel={sublabel} />;
}

export function ReportsPage() {
  const [whatsappChannelId, setWhatsappChannelId] = useState(ALL_CHANNELS);
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const { data: channels } = useSWR<Channel[]>("/api/channels");
  const overviewUrl =
    whatsappChannelId === ALL_CHANNELS
      ? "/api/reports/overview"
      : `/api/reports/overview?whatsappChannelId=${whatsappChannelId}`;
  const { data: overview } = useSWR<ReportOverview>(overviewUrl);

  const selectedChannelLabel =
    whatsappChannelId === ALL_CHANNELS
      ? "Todos os canais"
      : (channels?.find((c) => c.id === whatsappChannelId)?.displayNumber ?? "Todos os canais");

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Métricas", to: "/reports" }, { label: "Início" }]} />

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Métricas da plataforma</h1>
        <p className="text-muted-foreground mt-1 text-sm">Visão consolidada de atendimento e evolução dos canais.</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Canal: <span className="text-foreground font-medium">{selectedChannelLabel}</span>
        </p>
        <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Radio className="size-4" /> Selecionar canal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Selecionar canal</DialogTitle>
              <DialogDescription>
                Filtre todas as métricas desta tela por um canal específico, ou mantenha "Todos os canais" para a
                visão consolidada.
              </DialogDescription>
            </DialogHeader>
            <Select
              value={whatsappChannelId}
              onValueChange={(v) => {
                setWhatsappChannelId(v);
                setChannelDialogOpen(false);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CHANNELS}>Todos os canais</SelectItem>
                {channels?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Métricas dos contatos</h2>
        <p className="text-muted-foreground mt-1 mb-3 text-sm">
          Quantos contatos estão sendo conduzidos pela IA ou já escalados para atendimento humano, e quanto tempo em
          média dura a conversa de um contato, da primeira à última interação.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={Bot}
            iconClassName="bg-success/15 text-success"
            label="Contatos com agente"
            value={overview ? formatNumber(overview.contactsByStatus.withAgent) : "—"}
            sublabel="Em atendimento pela IA"
          />
          <MetricCard
            icon={Headset}
            iconClassName="bg-warning/15 text-warning"
            label="Contatos em atendimento humano"
            value={overview ? formatNumber(overview.contactsByStatus.withHuman) : "—"}
            sublabel="Escalados para atendente"
          />
          <MetricCard
            icon={Clock}
            iconClassName="bg-primary/10 text-primary"
            label="Tempo médio de conversa"
            value={overview ? formatDuration(overview.avgConversationDuration.avgDurationMs) : "—"}
            sublabel={
              overview
                ? `Primeira à última interação · ${formatNumber(overview.avgConversationDuration.sampleSize)} contatos`
                : ""
            }
          />
        </div>
      </div>

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Métricas de campanhas</h2>
        <p className="text-muted-foreground mt-1 mb-3 text-sm">
          Quantas campanhas já foram disparadas, quantos contatos realmente receberam a mensagem e qual fração
          desses contatos respondeu depois do disparo.
        </p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-stretch">
          <div className="flex flex-col gap-3">
            <MetricCard
              icon={Megaphone}
              iconClassName="bg-primary/10 text-primary"
              label="Total de campanhas"
              value={overview ? formatNumber(overview.campaignMetrics.totalCampaigns) : "—"}
              sublabel="Campanhas disparadas"
            />
            <div className="flex-1">{overview && <ResponseRateCard metrics={overview.campaignMetrics} />}</div>
          </div>
          {overview && <ResponsesByWeekdayCard metrics={overview.campaignMetrics} />}
        </div>
      </div>

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Métricas de atendimento</h2>
        <p className="text-muted-foreground mt-1 mb-3 text-sm">
          Qual fila recebe mais tickets e como está a velocidade de atendimento — tempo entre um atendente assumir o
          ticket e encerrá-lo — nas filas mais lenta e mais rápida.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QueueMetricCard
            icon={ListChecks}
            iconClassName="bg-primary/10 text-primary"
            label="Fila com mais interações"
            metric={overview?.queueMetrics.mostInteractions}
            valueKind="count"
          />
          <QueueMetricCard
            icon={Zap}
            iconClassName="bg-success/15 text-success"
            label="Fila com mais rapidez"
            metric={overview?.queueMetrics.fastest}
            valueKind="duration"
          />
          <QueueMetricCard
            icon={TrendingDown}
            iconClassName="bg-destructive/10 text-destructive"
            label="Fila com mais demora"
            metric={overview?.queueMetrics.slowest}
            valueKind="duration"
          />
        </div>
      </div>

      {overview && overview.channelCount > 1 && whatsappChannelId === ALL_CHANNELS && (
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Métricas de redes sociais</h2>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            Como os canais de redes sociais estão evoluindo em captação de contatos novos.
          </p>
          <Card className="shadow-xl">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Trophy className="size-5" />
                </div>
                <div>
                  <CardTitle>Top 5 canais que mais evoluíram</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Ranking dos canais com maior crescimento de contatos novos nos últimos 30 dias frente aos 30 dias
                    anteriores.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {overview.topChannelsByGrowth.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ainda não há dados suficientes para montar esse ranking.</p>
              ) : (
                <div className="border-border overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-left">Canal</TableHead>
                        <TableHead>Agente</TableHead>
                        <TableHead>Últimos 30 dias</TableHead>
                        <TableHead>30 dias anteriores</TableHead>
                        <TableHead>Crescimento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.topChannelsByGrowth.map((channel: ChannelGrowth, index: number) => (
                        <TableRow key={channel.channelId}>
                          <TableCell className="text-left">
                            <div className="flex items-center justify-start gap-2">
                              <div className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-sm text-xs font-medium">
                                {index + 1}
                              </div>
                              <Radio className="text-muted-foreground size-3.5 shrink-0" />
                              <span className="truncate font-medium">{channel.displayNumber}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{channel.agentName ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatNumber(channel.currentPeriodContacts)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatNumber(channel.previousPeriodContacts)}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center justify-center gap-1.5">
                              <span className={cn("size-1.5 rounded-sm", growthDotClassName(channel.growthPercent))} />
                              {formatGrowth(channel.growthPercent)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-success/15 text-success flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Award className="size-5" />
            </div>
            <div>
              <CardTitle>Top 5 atendentes que mais encerraram tickets</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Ranking dos atendentes com mais tickets encerrados, considerando todas as filas e ilhas de
                atendimento.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!overview || overview.topAttendantsByClosedTickets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {!overview ? "Carregando…" : "Ainda não há tickets encerrados para montar esse ranking."}
            </p>
          ) : (
            <div className="border-border overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Atendente</TableHead>
                    <TableHead>Tickets encerrados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.topAttendantsByClosedTickets.map((attendant: TopAttendant, index: number) => (
                    <TableRow key={attendant.userId}>
                      <TableCell className="text-left">
                        <div className="flex items-center justify-start gap-2">
                          <div className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-sm text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{attendant.name}</p>
                            {attendant.email && <p className="text-muted-foreground truncate text-xs">{attendant.email}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatNumber(attendant.closedTicketCount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
