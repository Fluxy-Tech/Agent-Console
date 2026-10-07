import { useState } from "react";
import useSWR from "swr";
import { Ban, Bot, Contact, Headset, SlidersHorizontal, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
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
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { PermissionAction } from "@/domain/permission-action";
import type { Agent, TargetListResult, TargetStats } from "@/types/domain";
import { BlockAgentsDialog } from "./block-agents-dialog";
import { MetadataFilterDialog } from "./metadata-filter-dialog";

const ALL = "all";
const PAGE_SIZE_OPTIONS = [10, 20, 50];

const STATUS_OPTIONS = [
  { value: ALL, label: "Todos" },
  { value: "AI", label: "IA" },
  { value: "HUMAN", label: "Humano" },
  { value: "FINISHED", label: "Finalizado" },
];

const STATUS_LABELS: Record<string, string> = { AI: "Agente", HUMAN: "Humano", FINISHED: "Finalizado" };
const STATUS_BADGE_VARIANTS: Record<string, "success" | "warning" | "secondary"> = {
  AI: "success",
  HUMAN: "warning",
  FINISHED: "secondary",
};
/// Borda na mesma cor do badge, só que mais forte que o fundo (15%) da variante.
const STATUS_BADGE_BORDERS: Record<string, string> = {
  AI: "border-success/60",
  HUMAN: "border-warning/70",
  FINISHED: "border-muted-foreground/40",
};
const STATUS_ICONS: Record<string, typeof Bot | undefined> = {
  AI: Bot,
  HUMAN: Headset,
};

type SortBy = "name" | "waId" | "status" | "lastInteractionAt";

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function TargetsListPage() {
  const can = useCan();
  const canWrite = can(PermissionAction.CONTACTS_WRITE);

  // includeDeleted: contatos antigos podem estar filtrados por um agente já
  // excluído — o filtro precisa continuar oferecendo essa opção.
  const { data: agents } = useSWR<Agent[]>("/api/agents?includeDeleted=true");

  const [agentId, setAgentId] = useState(ALL);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(ALL);
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [metadataKeys, setMetadataKeys] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("lastInteractionAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filterParams = new URLSearchParams();
  if (agentId !== ALL) filterParams.set("agentId", agentId);
  if (name) filterParams.set("name", name);
  if (phone) filterParams.set("phone", phone);
  if (email) filterParams.set("email", email);
  if (status !== ALL) filterParams.set("status", status);
  if (dateRange.from) filterParams.set("startDate", dateRange.from.toISOString());
  if (dateRange.to) filterParams.set("endDate", dateRange.to.toISOString());
  if (metadataKeys.length > 0) filterParams.set("metadataKeys", metadataKeys.join(","));

  const { data: stats } = useSWR<TargetStats>(`/api/targets/stats?${filterParams.toString()}`);

  const listParams = new URLSearchParams(filterParams);
  listParams.set("page", String(page));
  listParams.set("pageSize", String(pageSize));
  listParams.set("sortBy", sortBy);
  listParams.set("sortDir", sortDir);
  const { data: result, mutate } = useSWR<TargetListResult>(`/api/targets?${listParams.toString()}`);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / pageSize)) : 1;
  const blockedRate = stats && stats.total > 0 ? (stats.blocked / stats.total) * 100 : 0;

  function toggleSort(column: SortBy) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Contatos", to: "/targets" }, { label: "Lista" }]} />

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Contatos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Contatos cadastrados nas Redes sociais desta empresa.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={Users}
          iconClassName="bg-primary/10 text-primary"
          label="Total de contatos"
          value={stats ? formatNumber(stats.total) : "—"}
          sublabel="Contatos cadastrados"
        />
        <MetricCard
          icon={Ban}
          iconClassName="bg-destructive/10 text-destructive"
          label="Quantidade de contatos bloqueados"
          value={stats ? formatNumber(stats.blocked) : "—"}
          sublabel={`${blockedRate.toFixed(0)}% do total`}
        />
        <MetricCard
          icon={Contact}
          iconClassName="bg-primary/10 text-primary"
          label="Agente com mais contatos em conversa"
          value={stats?.primaryAgentName ?? "—"}
          sublabel="Responsável"
        />
      </div>

      <Card className="flex flex-col gap-3 p-4 shadow-xl">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Agente</Label>
            <Select
              value={agentId}
              onValueChange={(v) => {
                setAgentId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os agentes</SelectItem>
                {agents?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.deletedAt && " (excluído)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              placeholder="Buscar por nome..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Número</Label>
            <Input
              placeholder="Buscar por número..."
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input
              placeholder="Buscar por e-mail..."
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => setShowAdvanced((v) => !v)}>
              <SlidersHorizontal className="size-4" /> Filtros avançados
            </Button>
          </div>
        </div>

        {showAdvanced && (
          <div className="border-border grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <Label className="text-xs">Período (última interação)</Label>
              <DateRangePicker
                value={dateRange}
                onChange={(r) => {
                  setDateRange(r);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Metadados</Label>
              <MetadataFilterDialog
                selectedKeys={metadataKeys}
                onChange={(keys) => {
                  setMetadataKeys(keys);
                  setPage(1);
                }}
              />
            </div>
          </div>
        )}
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Contact className="size-5" />
            </div>
            <div>
              <CardTitle>Lista de contatos</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Contatos de todas as redes sociais cadastradas, filtrados conforme os campos acima.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border-border overflow-hidden rounded-lg border">
            {!result || result.items.length === 0 ? (
              <div className="text-muted-foreground p-6 text-sm">
                {!result ? "Carregando…" : "Nenhum contato encontrado."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">
                      <SortableTh label="Nome" active={sortBy === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                    </TableHead>
                    <TableHead>
                      <SortableTh label="Número" active={sortBy === "waId"} dir={sortDir} onClick={() => toggleSort("waId")} />
                    </TableHead>
                    <TableHead>Agente</TableHead>
                    <TableHead>
                      <SortableTh label="Status" active={sortBy === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
                    </TableHead>
                    <TableHead>
                      <SortableTh
                        label="Última interação"
                        active={sortBy === "lastInteractionAt"}
                        dir={sortDir}
                        onClick={() => toggleSort("lastInteractionAt")}
                      />
                    </TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((target) => {
                    const initial = target.name?.trim()?.[0]?.toUpperCase();
                    const StatusIcon = STATUS_ICONS[target.status];
                    return (
                      <TableRow key={target.id}>
                        <TableCell
                          className="cursor-pointer text-left"
                          onClick={() => window.open(`/targets/${target.id}`, "_blank")}
                        >
                          <div className="flex items-center justify-start gap-3">
                            <div className="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-sm text-sm font-medium">
                              {initial ?? <UserRound className="size-4" />}
                            </div>
                            <div>
                              {target.name ? (
                                <span className="font-medium">{target.name}</span>
                              ) : (
                                <Badge variant="secondary">Sem nome</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{target.waId ?? "—"}</TableCell>
                        <TableCell>{target.whatsappChannel?.agent?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE_VARIANTS[target.status]} className={cn("gap-1", STATUS_BADGE_BORDERS[target.status])}>
                            {StatusIcon && <StatusIcon className="size-3" />}
                            {STATUS_LABELS[target.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {target.lastInteractionAt
                            ? `${new Date(target.lastInteractionAt).toLocaleDateString("pt-BR")} às ${new Date(target.lastInteractionAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center">
                            <BlockAgentsDialog
                              targetId={target.id}
                              targetName={target.name || target.waId || target.bsuid || "este contato"}
                              blockedAgentIds={target.blockedAgentIds}
                              disabled={!canWrite}
                              onSaved={() => mutate()}
                            />
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
              Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, result.total)} de {result.total} contatos
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
