import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Download, History, ListChecks, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DateRange } from "@/components/calendar";
import { DateRangePicker } from "@/components/date-range-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/metric-card";
import { PaginationControls } from "@/components/pagination-controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api";
import { formatDuration } from "@/lib/format-duration";
import { fetcher } from "@/lib/fetcher";
import { displayTicketStatus } from "@/lib/ticket-status";
import type { IslandTicketListResult, ServiceIsland, TicketHistoryStats } from "@/types/domain";
import { TicketDetailDialog } from "./ticket-detail-dialog";

const ALL = "all";

const STATUS_OPTIONS = [
  { value: ALL, label: "Todos" },
  { value: "WAITING", label: "Aguardando" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "CONCLUDED", label: "Concluído" },
  { value: "CANCELED", label: "Cancelado" },
];

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function HistoryTab({ island }: { island: ServiceIsland }) {
  const [search, setSearch] = useState("");
  const [queueId, setQueueId] = useState(ALL);
  const [assignedUserId, setAssignedUserId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [closeTagId, setCloseTagId] = useState(ALL);
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const attendantOptions = Array.from(
    new Map((island.queues ?? []).flatMap((q) => q.members ?? []).map((m) => [m.userId, m.user])).values(),
  );

  const filterParams = new URLSearchParams();
  if (search) filterParams.set("search", search);
  if (queueId !== ALL) filterParams.set("queueId", queueId);
  if (assignedUserId !== ALL) filterParams.set("assignedUserId", assignedUserId);
  if (status === "WAITING" || status === "IN_PROGRESS") filterParams.set("status", status);
  if (status === "CONCLUDED" || status === "CANCELED") filterParams.set("outcome", status);
  if (closeTagId !== ALL) filterParams.set("closeTagId", closeTagId);
  if (dateRange.from) filterParams.set("startDate", dateRange.from.toISOString());
  if (dateRange.to) filterParams.set("endDate", dateRange.to.toISOString());

  const { data: stats } = useSWR<TicketHistoryStats>(
    `/api/service-islands/${island.id}/tickets/stats?${filterParams.toString()}`,
  );

  const listParams = new URLSearchParams(filterParams);
  listParams.set("page", String(page));
  listParams.set("pageSize", String(pageSize));
  const { data: tickets } = useSWR<IslandTicketListResult>(
    `/api/service-islands/${island.id}/tickets?${listParams.toString()}`,
  );

  const hasFilters = Boolean(
    search || queueId !== ALL || assignedUserId !== ALL || status !== ALL || closeTagId !== ALL || dateRange.from || dateRange.to,
  );

  function resetFilters() {
    setSearch("");
    setQueueId(ALL);
    setAssignedUserId(ALL);
    setStatus(ALL);
    setCloseTagId(ALL);
    setDateRange({});
    setPage(1);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const exportParams = new URLSearchParams(filterParams);
      exportParams.set("page", "1");
      exportParams.set("pageSize", "1000");
      const result = await fetcher<IslandTicketListResult>(`/api/service-islands/${island.id}/tickets?${exportParams.toString()}`);

      const header = ["Ticket", "Contato", "Telefone", "Fila", "Atendente", "Tag de fechamento", "Status", "Tempo de espera", "Duração", "Criado em", "Encerrado em"];
      const rows = result.items.map((t) => {
        const s = displayTicketStatus(t);
        return [
          `#${t.ticketNumber}`,
          t.target.name ?? "",
          t.target.waId ?? "",
          t.queue.name,
          t.assignedUser?.name ?? "",
          t.closeTag?.name ?? "",
          s.label,
          formatDuration(t.waitDurationMs),
          formatDuration(t.handlingDurationMs),
          new Date(t.createdAt).toLocaleString("pt-BR"),
          t.closedAt ? new Date(t.closedAt).toLocaleString("pt-BR") : "",
        ].map(csvCell);
      });

      const csv = [header.map(csvCell).join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historico-tickets-${island.name}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível exportar o histórico.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={ListChecks}
          iconClassName="bg-primary/10 text-primary"
          label="Total de tickets"
          value={stats ? stats.total : "—"}
          sublabel="No período filtrado"
        />
        <MetricCard
          icon={CheckCircle2}
          iconClassName="bg-success/15 text-success"
          label="Concluídos"
          value={stats ? stats.concluded : "—"}
          sublabel="Encerrados com resolução"
        />
        <MetricCard
          icon={Loader2}
          iconClassName="bg-warning/15 text-warning"
          label="Em andamento"
          value={stats ? stats.inProgress : "—"}
          sublabel="Aguardando ou em atendimento"
        />
        <MetricCard
          icon={XCircle}
          iconClassName="bg-destructive/15 text-destructive"
          label="Cancelados"
          value={stats ? stats.canceled : "—"}
          sublabel="Abandonados ou expirados"
        />
      </div>

      <Card className="p-4 shadow-xl">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
            <Label className="text-xs">Buscar</Label>
            <Input
              placeholder="Ticket, contato ou atendente..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Fila</Label>
            <Select
              value={queueId}
              onValueChange={(v) => {
                setQueueId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {(island.queues ?? []).map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Atendente</Label>
            <Select
              value={assignedUserId}
              onValueChange={(v) => {
                setAssignedUserId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {attendantOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
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
            <Label className="text-xs">Tag de fechamento</Label>
            <Select
              value={closeTagId}
              onValueChange={(v) => {
                setCloseTagId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {(island.closeTags ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
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
          <div className="flex items-end gap-2">
            <Button variant="outline" disabled={!hasFilters} onClick={resetFilters}>
              Limpar
            </Button>
            <Button variant="outline" disabled={exporting} onClick={exportCsv}>
              <Download className="size-4" /> Exportar
            </Button>
          </div>
        </div>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <History className="size-5" />
            </div>
            <div>
              <CardTitle>Tickets</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">Histórico de tickets desta ilha, filtrado conforme os campos acima.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
        <div className="border-border overflow-hidden rounded-lg border">
        {!tickets || tickets.items.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">
            {!tickets ? "Carregando…" : "Nenhum ticket encontrado com os filtros atuais."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Ticket</TableHead>
                <TableHead className="text-left">Contato</TableHead>
                <TableHead>Fila</TableHead>
                <TableHead>Atendente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tempo de espera</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Encerrado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.items.map((ticket) => {
                const s = displayTicketStatus(ticket);
                return (
                  <TableRow key={ticket.id} className="hover:bg-accent cursor-pointer" onClick={() => setSelectedTicketId(ticket.id)}>
                    <TableCell className="text-left">#{ticket.ticketNumber}</TableCell>
                    <TableCell className="text-left">
                      <div className="flex items-center gap-2">
                        <div className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-sm text-xs font-medium">
                          {(ticket.target.name || ticket.target.waId || "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate font-medium">{ticket.target.name || ticket.target.waId || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{ticket.queue.name}</TableCell>
                    <TableCell>{ticket.assignedUser?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell>{formatDuration(ticket.waitDurationMs)}</TableCell>
                    <TableCell>{formatDuration(ticket.handlingDurationMs)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {ticket.closedAt ? new Date(ticket.closedAt).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {tickets && tickets.total > 0 && (
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={tickets.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
        </div>
        </CardContent>
      </Card>

      <TicketDetailDialog ticketId={selectedTicketId} onOpenChange={(open) => !open && setSelectedTicketId(null)} />
    </div>
  );
}
