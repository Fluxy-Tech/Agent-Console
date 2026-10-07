import { useState } from "react";
import useSWR from "swr";
import { Activity, Award, Clock, Gauge, Hash, Headphones, Hourglass, ListChecks, Search, Send, Ticket, Timer, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDuration } from "@/lib/format-duration";
import { cn } from "@/lib/utils";
import type { AttendantSummary, IslandMonitoring, IslandTicket } from "@/types/domain";
import { RealtimeQueuesCard } from "./realtime-queues-card";

const MONITORING_REFRESH_MS = 8000;

const STATUS_LABELS: Record<AttendantSummary["status"], string> = { ONLINE: "Online", PAUSED: "Em pausa", OFFLINE: "Offline" };
const STATUS_DOT: Record<AttendantSummary["status"], string> = {
  ONLINE: "bg-success",
  PAUSED: "bg-warning",
  OFFLINE: "bg-muted-foreground",
};

function ticketInitial(ticket: IslandMonitoring["waitingTickets"][number]): string {
  return (ticket.target.name || ticket.target.waId || "?").charAt(0).toUpperCase();
}

function ticketDisplayName(ticket: IslandTicket): string {
  return ticket.target.name || ticket.target.waId || "—";
}

/// Média de tempo de atendimento AINDA EM ANDAMENTO — não confundir com
/// handlingDurationMs (que só existe pra ticket já fechado). Aqui é sempre
/// "agora - assignedAt" de cada ticket em atendimento, recalculada a cada
/// refresh dos dados.
function avgHandlingDuration(tickets: IslandTicket[]): number | null {
  const withAssignedAt = tickets.filter((t) => t.assignedAt);
  if (withAssignedAt.length === 0) return null;

  const totalMs = withAssignedAt.reduce((sum, t) => sum + (Date.now() - new Date(t.assignedAt!).getTime()), 0);
  return totalMs / withAssignedAt.length;
}

/// Média de tempo de espera AINDA EM ABERTO — "agora - createdAt" de cada
/// ticket aguardando (waitDurationMs não serve aqui, só existe depois que o
/// ticket é atribuído a um atendente).
function avgWaitDuration(tickets: IslandTicket[]): number | null {
  if (tickets.length === 0) return null;

  const totalMs = tickets.reduce((sum, t) => sum + (Date.now() - new Date(t.createdAt).getTime()), 0);
  return totalMs / tickets.length;
}

/// Entre os tickets aguardando, o "último que entrou" é o de createdAt mais
/// recente — aqui assignedAt sempre é null (ainda não foram atendidos).
function lastCreatedTicket(tickets: IslandTicket[]): IslandTicket | null {
  return tickets.reduce<IslandTicket | null>((latest, ticket) => {
    if (!latest || new Date(ticket.createdAt) > new Date(latest.createdAt)) return ticket;
    return latest;
  }, null);
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof Ticket; label: string; value: string }) {
  return (
    <div className="bg-card flex items-center gap-3 rounded-lg p-3 shadow-xl">
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}


function InProgressTicketsTable({ tickets, emptyLabel }: { tickets: IslandTicket[]; emptyLabel: string }) {
  if (tickets.length === 0) {
    return (
      <div className="border-border rounded-lg border p-6">
        <p className="text-muted-foreground text-center text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Contato</TableHead>
            <TableHead>Ticket</TableHead>
            <TableHead>Fila</TableHead>
            <TableHead>Tempo de espera na fila</TableHead>
            <TableHead>Atendente</TableHead>
            <TableHead>Tempo de atendimento</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => {
            const elapsedMs = ticket.assignedAt ? Date.now() - new Date(ticket.assignedAt).getTime() : null;

            return (
              <TableRow key={ticket.id}>
                <TableCell className="text-left">
                  <div className="flex items-center justify-start gap-2">
                    <div className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-sm text-xs font-medium">
                      {ticketInitial(ticket)}
                    </div>
                    <span className="truncate font-medium">{ticketDisplayName(ticket)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">#{ticket.ticketNumber}</TableCell>
                <TableCell className="text-muted-foreground">{ticket.queue.name}</TableCell>
                <TableCell className="text-muted-foreground">{formatDuration(ticket.waitDurationMs)}</TableCell>
                <TableCell className="text-muted-foreground">{ticket.assignedUser?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDuration(elapsedMs)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-sm bg-green-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-sm bg-green-500" />
                    </span>
                    Em atendimento
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function WaitingTicketsTable({ tickets, emptyLabel }: { tickets: IslandTicket[]; emptyLabel: string }) {
  if (tickets.length === 0) {
    return (
      <div className="border-border rounded-lg border p-6">
        <p className="text-muted-foreground text-center text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Contato</TableHead>
            <TableHead>Ticket</TableHead>
            <TableHead>Fila</TableHead>
            <TableHead>Tempo de espera</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => {
            const elapsedMs = Date.now() - new Date(ticket.createdAt).getTime();

            return (
              <TableRow key={ticket.id}>
                <TableCell className="text-left">
                  <div className="flex items-center justify-start gap-2">
                    <div className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-sm text-xs font-medium">
                      {ticketInitial(ticket)}
                    </div>
                    <span className="truncate font-medium">{ticketDisplayName(ticket)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">#{ticket.ticketNumber}</TableCell>
                <TableCell className="text-muted-foreground">{ticket.queue.name}</TableCell>
                <TableCell className="text-muted-foreground">{formatDuration(elapsedMs)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <span className="bg-warning size-1.5 rounded-sm" />
                    Aguardando
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function MonitoringTab({ islandId }: { islandId: string }) {
  const { data } = useSWR<IslandMonitoring>(`/api/service-islands/${islandId}/monitoring`, {
    refreshInterval: MONITORING_REFRESH_MS,
  });

  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [inProgressPage, setInProgressPage] = useState(1);
  const [inProgressPageSize, setInProgressPageSize] = useState(10);
  const [waitingPage, setWaitingPage] = useState(1);
  const [waitingPageSize, setWaitingPageSize] = useState(10);
  const [attendantPage, setAttendantPage] = useState(1);
  const [attendantPageSize, setAttendantPageSize] = useState(10);

  if (!data) return <p className="text-muted-foreground p-4 text-sm">Carregando…</p>;

  const avgHandlingMs = avgHandlingDuration(data.inProgressTickets);
  const lastWaitingTicket = lastCreatedTicket(data.waitingTickets);
  const avgWaitMs = avgWaitDuration(data.waitingTickets);
  const busiestQueue = data.queues.reduce<IslandMonitoring["queues"][number] | null>(
    (busiest, q) => (!busiest || q.waitingCount > busiest.waitingCount ? q : busiest),
    null,
  );

  const avgTicketsPerAttendant =
    data.attendants.total > 0
      ? Math.round(data.attendants.list.reduce((sum, a) => sum + a.ticketCount, 0) / data.attendants.total)
      : 0;
  const busiestAttendant = data.attendants.list.reduce<AttendantSummary | null>(
    (busiest, a) => (!busiest || a.ticketCount > busiest.ticketCount ? a : busiest),
    null,
  );

  const attendantRows = data.attendants.list
    .filter((a) => showAll || a.status === "ONLINE")
    .filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()));

  // Listas já vêm inteiras da API (1 fetch só) — a paginação aqui é só de
  // exibição (slice no client), por isso a página é sempre "grampeada" no
  // total atual em vez de resetada por efeito: se um filtro reduzir a lista,
  // a página cai sozinha pra última válida, nunca fica em branco.
  const inProgressTotalPages = Math.max(1, Math.ceil(data.inProgressTickets.length / inProgressPageSize));
  const inProgressPageClamped = Math.min(inProgressPage, inProgressTotalPages);
  const pagedInProgress = data.inProgressTickets.slice(
    (inProgressPageClamped - 1) * inProgressPageSize,
    inProgressPageClamped * inProgressPageSize,
  );

  const waitingTotalPages = Math.max(1, Math.ceil(data.waitingTickets.length / waitingPageSize));
  const waitingPageClamped = Math.min(waitingPage, waitingTotalPages);
  const pagedWaiting = data.waitingTickets.slice(
    (waitingPageClamped - 1) * waitingPageSize,
    waitingPageClamped * waitingPageSize,
  );

  const attendantTotalPages = Math.max(1, Math.ceil(attendantRows.length / attendantPageSize));
  const attendantPageClamped = Math.min(attendantPage, attendantTotalPages);
  const pagedAttendants = attendantRows.slice(
    (attendantPageClamped - 1) * attendantPageSize,
    attendantPageClamped * attendantPageSize,
  );

  return (
    <div className="bg-card overflow-hidden rounded-xl">
      <Tabs defaultValue="in-progress" className="gap-0">
        <TabsList className="border-border w-full justify-start rounded-none border-b">
          <TabsTrigger value="in-progress">
            <Headphones /> Em andamento
          </TabsTrigger>
          <TabsTrigger value="waiting">
            <Hourglass /> Aguardando atendimento
          </TabsTrigger>
          <TabsTrigger value="attendants">
            <Activity /> Atendentes
          </TabsTrigger>
          <TabsTrigger value="queues">
            <Send /> Filas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="in-progress">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="flex items-start gap-3">
            <div>
              <CardTitle className="text-base">Tickets em atendimento</CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">Tickets sendo conduzidos agora por um atendente humano.</p>
            </div>
          </div>
          <Badge className="bg-primary/10 text-primary gap-1.5 border-transparent">
            <Zap className="size-3.5" /> Em andamento
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile icon={Ticket} label="Quantidade de tickets" value={String(data.inProgressTickets.length)} />
            <InfoTile icon={Timer} label="Média de tempo de atendimento" value={formatDuration(avgHandlingMs)} />
            <InfoTile icon={Gauge} label="Média de tickets por atendente" value={String(avgTicketsPerAttendant)} />
            <InfoTile
              icon={Award}
              label="Atendente com mais tickets em atendimento"
              value={busiestAttendant ? busiestAttendant.name : "Nenhum"}
            />
          </div>
          <InProgressTicketsTable tickets={pagedInProgress} emptyLabel="Nenhum ticket em atendimento no momento." />
        </CardContent>
        {data.inProgressTickets.length > 0 && (
          <PaginationControls
            page={inProgressPageClamped}
            pageSize={inProgressPageSize}
            total={data.inProgressTickets.length}
            onPageChange={setInProgressPage}
            onPageSizeChange={(size) => {
              setInProgressPageSize(size);
              setInProgressPage(1);
            }}
          />
        )}
        </TabsContent>

        <TabsContent value="waiting">
        <CardHeader>
          <div>
            <CardTitle className="text-base">Tickets aguardando</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">Tickets na fila esperando um atendente humano assumir.</p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile icon={Ticket} label="Quantidade de tickets" value={String(data.waitingTickets.length)} />
            <InfoTile
              icon={Hash}
              label="Último ticket que entrou na fila"
              value={lastWaitingTicket ? `#${lastWaitingTicket.ticketNumber} · ${ticketDisplayName(lastWaitingTicket)}` : "Nenhum"}
            />
            <InfoTile
              icon={ListChecks}
              label="Fila com mais tickets"
              value={busiestQueue && busiestQueue.waitingCount > 0 ? busiestQueue.queueName : "Nenhuma"}
            />
            <InfoTile icon={Clock} label="Tempo médio de espera" value={formatDuration(avgWaitMs)} />
          </div>
          <WaitingTicketsTable tickets={pagedWaiting} emptyLabel="Nenhum ticket aguardando no momento." />
        </CardContent>
        {data.waitingTickets.length > 0 && (
          <PaginationControls
            page={waitingPageClamped}
            pageSize={waitingPageSize}
            total={data.waitingTickets.length}
            onPageChange={setWaitingPage}
            onPageSizeChange={(size) => {
              setWaitingPageSize(size);
              setWaitingPage(1);
            }}
          />
        )}
        </TabsContent>

        <TabsContent value="attendants">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div>
              <CardTitle>Status dos atendentes</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">Acompanhe a disponibilidade e o status da sua equipe.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-success/10 flex flex-col items-center gap-1 rounded-lg p-3 text-center">
              <span className="bg-success size-1.5 rounded-sm" />
              <p className="text-success text-xl font-semibold">{data.attendants.online}</p>
              <p className="text-muted-foreground text-xs">Online</p>
              <p className="text-muted-foreground text-[11px]">
                {data.attendants.total > 0 ? Math.round((data.attendants.online / data.attendants.total) * 100) : 0}% do total
              </p>
            </div>
            <div className="bg-warning/10 flex flex-col items-center gap-1 rounded-lg p-3 text-center">
              <span className="bg-warning size-1.5 rounded-sm" />
              <p className="text-warning text-xl font-semibold">{data.attendants.paused}</p>
              <p className="text-muted-foreground text-xs">Em pausa</p>
              <p className="text-muted-foreground text-[11px]">
                {data.attendants.total > 0 ? Math.round((data.attendants.paused / data.attendants.total) * 100) : 0}% do total
              </p>
            </div>
            <div className="bg-muted flex flex-col items-center gap-1 rounded-lg p-3 text-center">
              <span className="bg-muted-foreground size-1.5 rounded-sm" />
              <p className="text-xl font-semibold">{data.attendants.offline}</p>
              <p className="text-muted-foreground text-xs">Offline</p>
              <p className="text-muted-foreground text-[11px]">
                {data.attendants.total > 0 ? Math.round((data.attendants.offline / data.attendants.total) * 100) : 0}% do total
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm">
                <Users className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Lista de atendentes dessa ilha</p>
                <p className="text-muted-foreground text-xs">
                  {attendantRows.length} {attendantRows.length === 1 ? "atendente encontrado" : "atendentes encontrados"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-72">
                <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Buscar atendente..."
                  className="pl-7 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Ver só online" : "Ver todos os atendentes"}
              </Button>
            </div>
          </div>

          <div className="border-border overflow-hidden rounded-lg border">
            {attendantRows.length === 0 ? (
              <p className="text-muted-foreground p-6 text-center text-sm">Nenhum atendente encontrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Atendente</TableHead>
                    <TableHead>Fila</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedAttendants.map((a) => (
                    <TableRow key={a.userId}>
                      <TableCell className="text-left">
                        <div className="flex items-center justify-start gap-2">
                          <div className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-sm text-xs font-medium">
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate font-medium">{a.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-primary/10 text-primary border-transparent">{a.queueName}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.ticketCount}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <span className={cn("size-1.5 rounded-sm", STATUS_DOT[a.status])} />
                          {STATUS_LABELS[a.status]}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {attendantRows.length > 0 && (
              <PaginationControls
                page={attendantPageClamped}
                pageSize={attendantPageSize}
                total={attendantRows.length}
                onPageChange={setAttendantPage}
                onPageSizeChange={(size) => {
                  setAttendantPageSize(size);
                  setAttendantPage(1);
                }}
              />
            )}
          </div>
        </CardContent>
        </TabsContent>

        <TabsContent value="queues">
          <RealtimeQueuesCard islandId={islandId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
