import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { AlertTriangle, CheckCircle2, List, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DateRange } from "@/components/calendar";
import { DateRangePicker } from "@/components/date-range-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/metric-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTh } from "@/components/sortable-th";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Channel, CampaignFilterOptions, CampaignListResult, CampaignStats } from "@/types/domain";

const ALL = "all";

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

const STATUS_OPTIONS = [
  { value: ALL, label: "Todos" },
  { value: "PROCESSING", label: "Enviando" },
  { value: "COMPLETED", label: "Concluída" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function CampaignHistoryTab() {
  const navigate = useNavigate();

  const [whatsappChannelId, setWhatsappChannelId] = useState(ALL);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [templateName, setTemplateName] = useState(ALL);
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: channels } = useSWR<Channel[]>("/api/channels");
  const { data: filterOptions } = useSWR<CampaignFilterOptions>("/api/campaigns/filter-options");

  const filterParams = new URLSearchParams();
  if (whatsappChannelId !== ALL) filterParams.set("whatsappChannelId", whatsappChannelId);
  if (search) filterParams.set("search", search);
  if (status !== ALL) filterParams.set("status", status);
  if (templateName !== ALL) filterParams.set("templateName", templateName);
  if (dateRange.from) filterParams.set("startDate", dateRange.from.toISOString());
  if (dateRange.to) filterParams.set("endDate", dateRange.to.toISOString());

  const { data: stats } = useSWR<CampaignStats>(`/api/campaigns/stats?${filterParams.toString()}`);

  const listParams = new URLSearchParams(filterParams);
  listParams.set("page", String(page));
  listParams.set("pageSize", String(pageSize));
  listParams.set("sortDir", sortDir);
  const { data: result } = useSWR<CampaignListResult>(`/api/campaigns?${listParams.toString()}`);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / pageSize)) : 1;
  const hasFilters = Boolean(
    whatsappChannelId !== ALL || search || status !== ALL || templateName !== ALL || dateRange.from || dateRange.to,
  );

  function resetFilters() {
    setWhatsappChannelId(ALL);
    setSearch("");
    setStatus(ALL);
    setTemplateName(ALL);
    setDateRange({});
    setPage(1);
  }

  const failureRate = stats && stats.totalMessagesSent > 0 ? (stats.totalFailures / stats.totalMessagesSent) * 100 : 0;
  const completionRate = stats && stats.totalCampaigns > 0 ? (stats.completedCampaigns / stats.totalCampaigns) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Send}
          iconClassName="bg-primary/10 text-primary"
          label="Campanhas"
          value={stats ? formatNumber(stats.totalCampaigns) : "—"}
          sublabel="Total criadas"
        />
        <MetricCard
          icon={CheckCircle2}
          iconClassName="bg-success/15 text-success"
          label="Concluídas"
          value={stats ? formatNumber(stats.completedCampaigns) : "—"}
          sublabel={`${completionRate.toFixed(0)}% do total`}
        />
        <MetricCard
          icon={Send}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          label="Mensagens enviadas"
          value={stats ? formatNumber(stats.totalMessagesSent) : "—"}
          sublabel="Total disparado"
        />
        <MetricCard
          icon={AlertTriangle}
          iconClassName="bg-warning/15 text-warning"
          label="Falhas"
          value={stats ? formatNumber(stats.totalFailures) : "—"}
          sublabel={`${failureRate.toFixed(2).replace(".", ",")}% do total`}
        />
      </div>

      <Card className="p-4 shadow-xl">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px_220px_auto] lg:items-end">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Buscar</Label>
            <Input
              placeholder="Buscar campanha..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Rede social</Label>
            <Select
              value={whatsappChannelId}
              onValueChange={(v) => {
                setWhatsappChannelId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {channels?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Template</Label>
            <Select
              value={templateName}
              onValueChange={(v) => {
                setTemplateName(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {filterOptions?.templates.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Período</Label>
            <DateRangePicker
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(1);
              }}
            />
          </div>
          <Button variant="outline" disabled={!hasFilters} onClick={resetFilters}>
            Limpar filtros
          </Button>
        </div>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <List className="size-5" />
            </div>
            <div>
              <CardTitle>Relatório dos disparos</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Histórico de campanhas com template, agente, canal, quem disparou e o progresso de envio.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border-border overflow-hidden rounded-lg border">
            {!result || result.items.length === 0 ? (
              <div className="text-muted-foreground p-6 text-sm">
                {!result ? "Carregando…" : "Nenhuma campanha encontrada."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Campanha</TableHead>
                    <TableHead>Template/Tipo</TableHead>
                    <TableHead>Agente / Canal</TableHead>
                    <TableHead>Enviado por</TableHead>
                    <TableHead>
                      <SortableTh
                        label="Data / Hora"
                        active
                        dir={sortDir}
                        onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                      />
                    </TableHead>
                    <TableHead>Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((c) => {
                    const progressPct = c.expectedContacts > 0 ? Math.round((c.totalContacts / c.expectedContacts) * 100) : 0;
                    const sentAt = new Date(c.sentAt);

                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-left">
                          <div className="flex items-center justify-start gap-3">
                            <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                              <Send className="size-4" />
                            </div>
                            <div className="min-w-0 text-left">
                              <button
                                type="button"
                                className="text-left font-medium hover:underline"
                                onClick={() => navigate(`/campaigns/${c.id}`)}
                              >
                                {c.name}
                              </button>
                              <p className="text-muted-foreground text-xs">ID: {c.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <span>{c.templateName}</span>
                            {c.category && (
                              <span className="text-muted-foreground text-xs">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1 text-sm">
                            <span>{c.agentName}</span>
                            <span className="text-muted-foreground text-xs">{c.whatsappChannelDisplayNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex flex-col items-center">
                            <span>{c.createdByName ?? "—"}</span>
                            <span className="text-xs">{c.createdByEmail ?? ""}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          <div className="flex flex-col items-center">
                            <span>{sentAt.toLocaleDateString("pt-BR")}</span>
                            <span className="text-xs">{sentAt.toLocaleTimeString("pt-BR")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs">
                              {formatNumber(c.totalContacts)} / {formatNumber(c.expectedContacts)}
                            </span>
                            <div className="bg-muted h-1.5 w-28 overflow-hidden rounded-sm">
                              <div
                                className={progressPct >= 100 ? "bg-success h-full" : "bg-primary h-full"}
                                style={{ width: `${Math.min(progressPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground text-xs">{progressPct}%</span>
                            {c.totalFailures > 0 && (
                              <span className="text-destructive text-xs">{c.totalFailures} falha(s)</span>
                            )}
                            {c.status === "PROCESSING" && c.batchSize !== null && !c.active && (
                              <Badge variant="outline">Pausada</Badge>
                            )}
                            {c.status === "PROCESSING" &&
                              c.active &&
                              c.scheduledAt &&
                              new Date(c.scheduledAt).getTime() > Date.now() && (
                                <Badge variant="outline">
                                  Agendada · {new Date(c.scheduledAt).toLocaleString("pt-BR")}
                                </Badge>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>

        {result && result.total > 0 && (
          <div className="border-border flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground text-sm">
              Exibindo {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, result.total)} de {result.total} campanhas
            </span>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-medium">
                  {page}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Próxima
                </Button>
              </div>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger size="sm" className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} por página
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
