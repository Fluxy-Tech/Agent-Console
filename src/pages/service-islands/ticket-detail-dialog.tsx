import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Download, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageBubble } from "@/components/message-bubble";
import { formatDuration } from "@/lib/format-duration";
import { api, ApiError } from "@/lib/api";
import { displayTicketStatus, SESSION_WINDOW_MS } from "@/lib/ticket-status";
import type { TicketDetail } from "@/types/domain";

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

interface TicketDetailDialogProps {
  ticketId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function TicketDetailDialog({ ticketId, onOpenChange }: TicketDetailDialogProps) {
  const { data: ticket, mutate } = useSWR<TicketDetail>(ticketId ? `/api/tickets/${ticketId}` : null);
  const { mutate: globalMutate } = useSWRConfig();
  const [reopening, setReopening] = useState(false);

  const canReopen =
    ticket &&
    ticket.status === "CLOSED" &&
    Date.now() - new Date(ticket.messagingSession.lastCustomerMessageAt).getTime() < SESSION_WINDOW_MS;

  async function handleReopen() {
    if (!ticket) return;
    setReopening(true);
    try {
      await api.post(`/api/tickets/${ticket.id}/reopen`);
      toast.success("Ticket reaberto.");
      await mutate();
      await globalMutate((key) => typeof key === "string" && key.startsWith("/api/service-islands/"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível reabrir o ticket.");
    } finally {
      setReopening(false);
    }
  }

  function exportConversation() {
    if (!ticket) return;
    const status = displayTicketStatus(ticket);

    const infoLines = [
      ["Ticket", `#${ticket.ticketNumber}`],
      ["Contato", ticket.target.name ?? ""],
      ["Telefone", ticket.target.waId ?? ""],
      ["Fila", ticket.queue.name],
      ["Atendente", ticket.assignedUser?.name ?? ""],
      ["Status", status.label],
      ["Tag de fechamento", ticket.closeTag?.name ?? ""],
      ["Tempo de espera", formatDuration(ticket.waitDurationMs)],
      ["Duração do atendimento", formatDuration(ticket.handlingDurationMs)],
      ["Iniciado em", new Date(ticket.createdAt).toLocaleString("pt-BR")],
      ["Encerrado em", ticket.closedAt ? new Date(ticket.closedAt).toLocaleString("pt-BR") : ""],
    ]
      .map(([k, v]) => `${csvCell(k)},${csvCell(v)}`)
      .join("\n");

    const messagesHeader = ["Data/Hora", "Direção", "Remetente", "Mensagem"].map(csvCell).join(",");
    const messagesRows = ticket.history
      .map((m) =>
        [
          new Date(m.createdAt).toLocaleString("pt-BR"),
          m.direction === "OUTBOUND" ? "Enviada" : "Recebida",
          m.senderType,
          m.text || `[${m.messageType}]`,
        ]
          .map(csvCell)
          .join(","),
      )
      .join("\n");

    const csv = [infoLines, "", messagesHeader, messagesRows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-${ticket.ticketNumber}-conversa.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={ticketId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-6xl overflow-hidden p-0">
        {!ticket ? (
          <div className="text-muted-foreground p-6 text-sm">Carregando…</div>
        ) : (
          <div className="flex max-h-[85vh] flex-col">
            <DialogHeader className="border-b px-6 py-4">
              <div className="flex items-center gap-2 pr-6">
                <DialogTitle>
                  Ticket #{ticket.ticketNumber} · {ticket.queue.name}
                </DialogTitle>
                <Badge variant={displayTicketStatus(ticket).variant}>{displayTicketStatus(ticket).label}</Badge>
              </div>
              <DialogDescription>
                Histórico de conversa com {ticket.target.name || ticket.target.waId || "o contato"}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[260px_1fr_280px]">
              <div className="border-border flex flex-col gap-3 border-b p-4 md:border-r md:border-b-0">
                <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Contato</h3>
                <div>
                  <p className="text-sm font-medium">{ticket.target.name || "Sem nome"}</p>
                  <p className="text-muted-foreground text-xs">{ticket.target.waId ?? "Telefone não informado"}</p>
                  {ticket.target.email && <p className="text-muted-foreground text-xs">{ticket.target.email}</p>}
                </div>

                <div className="flex flex-col gap-2 border-t pt-3 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">Primeiro contato</span>
                    <span>
                      {new Date(ticket.history[0]?.createdAt ?? ticket.createdAt).toLocaleDateString("pt-BR")} às{" "}
                      {new Date(ticket.history[0]?.createdAt ?? ticket.createdAt).toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">Total de interações</span>
                    <span>{ticket.history.length}</span>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-y-auto bg-[#F4F1EA] p-4">
                <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">Conversa</h3>
                <div className="flex flex-col gap-3">
                  {ticket.history.map((message) => (
                    <MessageBubble
                      key={message._id}
                      message={message}
                      attendantName={ticket.assignedUser?.name}
                      agentBubbleClassName="bg-[#D6FDD0]"
                      agentTextClassName="text-black"
                    />
                  ))}
                  {ticket.history.length === 0 && (
                    <p className="text-muted-foreground text-sm">Nenhuma mensagem encontrada.</p>
                  )}
                </div>
              </div>

              <div className="border-border flex flex-col gap-3 border-t p-4 md:border-t-0 md:border-l">
                <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Atendente</h3>
                <div>
                  <p className="text-sm font-medium">{ticket.assignedUser?.name ?? "—"}</p>
                  <p className="text-muted-foreground text-xs">{ticket.assignedUser?.email ?? ""}</p>
                </div>
                <div className="flex flex-col gap-1.5 border-t pt-3 text-xs">
                  {ticket.closeTag && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tag de fechamento</span>
                      <span>{ticket.closeTag.name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tempo de espera</span>
                    <span>{formatDuration(ticket.waitDurationMs)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duração do atendimento</span>
                    <span>{formatDuration(ticket.handlingDurationMs)}</span>
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-2 border-t pt-3">
                  <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Ações</h3>
                  {canReopen && (
                    <Button loading={reopening} variant="outline" size="sm" disabled={reopening} onClick={handleReopen}>
                      <RotateCcw className="size-3.5" /> {reopening ? "Reabrindo…" : "Reabrir ticket"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={exportConversation}>
                    <Download className="size-3.5" /> Exportar conversa
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
