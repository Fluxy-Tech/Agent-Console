import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { Bot, BriefcaseBusiness, Calendar, IdCard, LogIn, LogOut, Mail, Phone, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageBubble } from "@/components/message-bubble";
import { MetadataView } from "@/components/metadata-view";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { PaginationControls } from "@/components/pagination-controls";
import { PermissionAction } from "@/domain/permission-action";
import { useCan } from "@/hooks/use-can";
import { api, ApiError } from "@/lib/api";
import { formatDateAtTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { TicketDetailDialog } from "../service-islands/ticket-detail-dialog";
import { TargetCarteirasDialog } from "./target-carteiras-dialog";
import type { MessageDocument, MessageType, Target, TicketSummary } from "@/types/domain";

const STATUS_LABELS: Record<string, string> = { AI: "IA", HUMAN: "Humano", FINISHED: "Finalizado" };
const TICKET_STATUS_LABELS: Record<string, string> = { WAITING: "Aguardando", IN_PROGRESS: "Em andamento", CLOSED: "Encerrado" };

const TYPE_FILTERS: { value: MessageType | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "TEXT", label: "Texto" },
  { value: "AUDIO", label: "Áudio" },
  { value: "STICKER", label: "Figurinha" },
  { value: "VIDEO", label: "Vídeo" },
  { value: "DOCUMENT", label: "Documento" },
  { value: "IMAGE", label: "Foto" },
];

interface TimelineEntry {
  createdAt: string;
  node: ReactNode;
}

/// Mensagem não guarda quem exatamente respondeu (o Mongo não sabe qual
/// atendente — só o Postgres, via TicketMessage) — aproxima pelo ticket cuja
/// janela [createdAt, closedAt] contém o horário da mensagem, já que só um
/// atendente por vez fica com um ticket em aberto.
function resolveAttendantName(messageCreatedAt: string, tickets: TicketSummary[]): string {
  const messageTime = new Date(messageCreatedAt).getTime();
  const ticket = tickets.find((t) => {
    const opened = new Date(t.createdAt).getTime();
    const closed = t.closedAt ? new Date(t.closedAt).getTime() : Infinity;
    return messageTime >= opened && messageTime <= closed;
  });
  return ticket?.assignedUser?.name ?? "Atendente";
}

function resolveSenderLabel(message: MessageDocument, target: Target, tickets: TicketSummary[]): string {
  switch (message.senderType) {
    case "CUSTOMER":
      return target.name || target.waId || "Cliente";
    case "AGENT_AI":
      return target.whatsappChannel?.agent?.name ?? "Agente de IA";
    case "ATTENDANT":
      return resolveAttendantName(message.createdAt, tickets);
    case "CAMPAIGN":
      return `Campanha: ${message.templateName ?? "template"}`;
    default:
      return "Sistema";
  }
}

/// Intercala as mensagens com marcadores de abertura/encerramento de ticket
/// no ponto certo da linha do tempo, ordenando tudo por createdAt — os
/// tickets sempre aparecem independente do filtro de tipo de mensagem
/// aplicado (são contexto da conversa, não mensagens).
function buildTimeline(history: MessageDocument[], tickets: TicketSummary[], target: Target): TimelineEntry[] {
  const entries: TimelineEntry[] = history.map((message) => ({
    createdAt: message.createdAt,
    node: (
      <MessageBubble
        key={message._id}
        message={message}
        senderLabelOverride={resolveSenderLabel(message, target, tickets)}
        agentBubbleClassName="bg-[#D6FDD0]"
        agentTextClassName="text-black"
      />
    ),
  }));

  for (const ticket of tickets) {
    entries.push({
      createdAt: ticket.createdAt,
      node: <TicketDivider key={`${ticket.id}-open`} ticketNumber={ticket.ticketNumber} label="Abertura" />,
    });
    if (ticket.closedAt) {
      entries.push({
        createdAt: ticket.closedAt,
        node: <TicketDivider key={`${ticket.id}-close`} ticketNumber={ticket.ticketNumber} label="Encerramento" />,
      });
    }
  }

  return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function TicketDivider({ ticketNumber, label }: { ticketNumber: number; label: "Abertura" | "Encerramento" }) {
  const isOpen = label === "Abertura";
  return (
    <div className="my-2 flex items-center gap-3">
      <div className="border-border h-px flex-1 border-t" />
      <Badge variant={isOpen ? "success" : "destructive"} className="shrink-0 gap-1.5 px-3 py-1 text-xs font-semibold">
        {isOpen ? <LogIn className="size-3.5" /> : <LogOut className="size-3.5" />}
        Ticket #{ticketNumber} · {label}
      </Badge>
      <div className="border-border h-px flex-1 border-t" />
    </div>
  );
}

export function TargetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: target, mutate } = useSWR<Target>(id ? `/api/targets/${id}` : null);
  const can = useCan();
  const canWrite = can(PermissionAction.CONTACTS_WRITE);
  const [creatingCard, setCreatingCard] = useState(false);
  const [messageType, setMessageType] = useState<MessageType | "">("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketsPage, setTicketsPage] = useState(1);
  const [ticketsPageSize, setTicketsPageSize] = useState(10);

  const historyParams = new URLSearchParams({ limit: "200" });
  if (messageType) historyParams.set("messageType", messageType);
  const { data: history } = useSWR<MessageDocument[]>(
    id ? `/api/targets/${id}/history?${historyParams.toString()}` : null,
  );

  if (!target) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  const hasCrmCard = !!target.cardCrm;

  async function handleCreateCrmCard() {
    setCreatingCard(true);
    try {
      await api.post(`/api/targets/${id}/crm-card`);
      toast.success("Card criado no CRM.");
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível gerar o card no CRM.");
    } finally {
      setCreatingCard(false);
    }
  }

  const totalTickets = target.tickets?.length ?? 0;
  const paginatedTickets = (target.tickets ?? []).slice(
    (ticketsPage - 1) * ticketsPageSize,
    ticketsPage * ticketsPageSize,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb
        items={[{ label: "Contatos", to: "/targets" }, { label: target.name || target.waId || "Contato" }]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              {target.name || target.waId || "Contato sem nome"}
            </h1>
            <Badge variant="outline">{STATUS_LABELS[target.status]}</Badge>
          </div>
          {target.email && <p className="text-muted-foreground mt-1 text-sm">{target.email}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TargetCarteirasDialog
            targetId={target.id}
            canWrite={canWrite}
            trigger={
              <Button variant="outline">
                <WalletCards className="size-4" /> Carteiras
              </Button>
            }
          />
          <Button
            variant="outline"
            disabled={hasCrmCard || !canWrite || creatingCard}
            onClick={handleCreateCrmCard}
            title={hasCrmCard ? "Este contato já possui um card no CRM" : undefined}
          >
            <BriefcaseBusiness className="size-4" />
            {creatingCard ? "Gerando…" : "Gerar card no CRM"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Histórico de conversa</TabsTrigger>
          <TabsTrigger value="tickets">Tickets de atendimento</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
            <div className="flex flex-col gap-6">
              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle>Metadados</CardTitle>
                </CardHeader>
                <CardContent>
                  <MetadataView metadata={target.metadata} />
                </CardContent>
              </Card>

              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle>Informações de contato</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Mail className="size-4" /> E-mail
                    </span>
                    <span className="font-medium">{target.email ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="size-4" /> Data de criação
                    </span>
                    <span className="font-medium">{formatDateAtTime(target.firstInteractionAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Phone className="size-4" /> Telefone
                    </span>
                    <span className="font-medium">{target.waId ?? "Não informado"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <IdCard className="size-4" /> BSUID
                    </span>
                    <span className="font-medium">{target.bsuid ?? "Ainda não recebido"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-primary flex items-center gap-2">
                    <Bot className="size-5" /> Agente de IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {target.whatsappChannel?.agent?.name ? (
                    <p className="text-sm">
                      Este contato está sendo monitorado pelo agente de IA{" "}
                      <strong>{target.whatsappChannel.agent.name}</strong>.
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">Nenhum agente de IA vinculado a este canal.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* aside: gruda no topo da viewport ao rolar a página (sticky) e
                nunca passa da altura da tela (max-h em cima de 100dvh, sem
                depender do breakpoint lg) — antes o cap só existia em telas
                grandes, então em janelas menores o card crescia com o
                conteúdo e estourava a viewport. */}
            <aside className="flex min-h-0 max-h-[calc(100dvh-3rem)] flex-col lg:sticky lg:top-6">
              <Card className="flex min-h-0 flex-1 flex-col shadow-xl">
                <CardHeader>
                  <CardTitle>Histórico de conversas</CardTitle>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="flex flex-wrap gap-1.5">
                    {TYPE_FILTERS.map((filter) => (
                      <button
                        key={filter.value}
                        onClick={() => setMessageType(filter.value)}
                        className={cn(
                          "rounded-sm border px-3 py-1 text-xs font-medium transition-colors",
                          messageType === filter.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background",
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>

                  {!history || history.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda.</p>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-[#F4F1EA] p-3">
                      {buildTimeline(history, target.tickets ?? [], target).map((entry) => entry.node)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="tickets">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Tickets de atendimento humano</CardTitle>
            </CardHeader>
            <CardContent>
              {totalTickets === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum ticket para este contato ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Ticket</TableHead>
                      <TableHead>Fila</TableHead>
                      <TableHead>Ilha</TableHead>
                      <TableHead>Atendente</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        className="hover:bg-accent cursor-pointer"
                        onClick={() => setSelectedTicketId(ticket.id)}
                      >
                        <TableCell className="text-left">#{ticket.ticketNumber}</TableCell>
                        <TableCell>{ticket.queue.name}</TableCell>
                        <TableCell>{ticket.queue.serviceIsland.name}</TableCell>
                        <TableCell>{ticket.assignedUser?.email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{TICKET_STATUS_LABELS[ticket.status]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {totalTickets > 0 && (
              <PaginationControls
                page={ticketsPage}
                pageSize={ticketsPageSize}
                total={totalTickets}
                onPageChange={setTicketsPage}
                onPageSizeChange={(size) => {
                  setTicketsPageSize(size);
                  setTicketsPage(1);
                }}
              />
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <TicketDetailDialog ticketId={selectedTicketId} onOpenChange={(open) => !open && setSelectedTicketId(null)} />
    </div>
  );
}
