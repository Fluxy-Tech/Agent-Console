import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSWR, { mutate as mutateGlobal } from "swr";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { refreshSupportUnread } from "@/hooks/use-support-unread";
import { api, ApiError } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";
import type { SupportSeverity, SupportTicketDetail, SupportTicketStatus } from "@/types/domain";
import { AttachmentList, PendingFileChips, useSupportFilePicker } from "./support-attachments";
import {
  SEVERITIES,
  SEVERITY_INFO,
  STATUSES,
  STATUS_INFO,
  SUPPORT_TICKETS_KEY,
  formatDateTime,
  uploadSupportFiles,
} from "./support-config";
import { ChatBubble, DetailRow, TicketDivider } from "./support-shared";

/// TIME DE SUPORTE — conversa de um ticket (/support/:id), no estilo do Desk.
/// Quem atende vê a empresa, responde, muda o status e reclassifica. A
/// conversa do lado da empresa é outra tela (pages/technical-support).
export function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUserId = useAppSelector((state) => state.auth.user?.id);

  // Atualiza sozinho a cada 10s pra resposta da empresa aparecer sem
  // recarregar a página (as URLs dos anexos duram 1h, renovadas a cada GET).
  const {
    data: ticket,
    error,
    mutate,
  } = useSWR<SupportTicketDetail>(id ? `/api/support/tickets/${id}` : null, { refreshInterval: 10000 });

  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const picker = useSupportFilePicker(files, setFiles);

  // Troca de ticket na lista: não carrega rascunho de um pro outro.
  useEffect(() => {
    setContent("");
    setFiles([]);
  }, [id]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCount = ticket?.messages.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messageCount, id]);

  // Marca como lido até a mensagem mais recente que ESTA tela mostrou (não
  // "agora" — o que chegar depois continua não lido). Só com a aba visível:
  // mensagem que chega com a pessoa em outra aba fica não lida e gera a
  // notificação; ao voltar pra aba, marca.
  const ticketId = ticket?.id;
  const readUpTo = ticket ? (ticket.messages.at(-1)?.createdAt ?? ticket.createdAt) : null;
  useEffect(() => {
    if (!ticketId || !readUpTo) return;

    const markRead = async () => {
      if (document.hidden) return;
      try {
        await api.post(`/api/support/tickets/${ticketId}/read`, { readUpTo });
        await Promise.all([refreshSupportUnread(), mutateGlobal(SUPPORT_TICKETS_KEY)]);
      } catch {
        // Silencioso: no pior caso o contador continua até a próxima leitura.
      }
    };

    void markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [ticketId, readUpTo]);

  // Todos os anexos do ticket (abertura + mensagens), pro painel lateral.
  const allAttachments = useMemo(
    () => (ticket ? [...ticket.attachments, ...ticket.messages.flatMap((message) => message.attachments)] : []),
    [ticket],
  );

  async function handleSend(event?: React.FormEvent) {
    event?.preventDefault();
    if (!ticket || (!content.trim() && files.length === 0)) return;
    setSending(true);
    try {
      const attachments = await uploadSupportFiles(files, ticket.id);
      await api.post(`/api/support/tickets/${ticket.id}/messages`, { content, attachments });
      setContent("");
      setFiles([]);
      await Promise.all([mutate(), mutateGlobal(SUPPORT_TICKETS_KEY)]);
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function handleUpdate(patch: { status?: SupportTicketStatus; severity?: SupportSeverity }, successMessage: string) {
    if (!ticket) return;
    setUpdating(true);
    try {
      await api.patch(`/api/support/tickets/${ticket.id}`, patch);
      toast.success(successMessage);
      await Promise.all([mutate(), mutateGlobal(SUPPORT_TICKETS_KEY)]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar o ticket.");
    } finally {
      setUpdating(false);
    }
  }

  // 404 com o ticket já aberto = reclassificado pra uma classificação que esta
  // pessoa do suporte não atende (ou id inválido).
  if (error) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
        <p>Este ticket não está disponível para você.</p>
        <p className="max-w-sm text-xs">
          Ele pode ter sido reclassificado para uma classificação atendida por outra pessoa do time.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/support")}>
          Voltar para os tickets
        </Button>
      </div>
    );
  }

  if (!ticket) {
    return <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">Carregando…</div>;
  }

  const severity = SEVERITY_INFO[ticket.severity];
  const status = STATUS_INFO[ticket.status];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-border bg-background/80 flex flex-wrap items-center gap-3 border-b px-4 py-3 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Voltar para a lista"
          onClick={() => navigate("/support")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ticket.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            Ticket #{ticket.code} · {ticket.organization.name} · aberto por {ticket.openedBy.name}
          </p>
        </div>
        <Badge variant={severity.badge}>
          {severity.label} · {severity.name}
        </Badge>
        <Badge variant={status.badge}>{status.label}</Badge>
        <div className="flex gap-2">
          <Select
            value={ticket.status}
            disabled={updating}
            onValueChange={(value) => handleUpdate({ status: value as SupportTicketStatus }, "Status atualizado.")}
          >
            <SelectTrigger className="h-10 w-[170px]" aria-label="Status do ticket">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((key) => (
                <SelectItem key={key} value={key}>
                  {STATUS_INFO[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={ticket.severity}
            disabled={updating}
            onValueChange={(value) => handleUpdate({ severity: value as SupportSeverity }, "Classificação atualizada.")}
          >
            <SelectTrigger className="h-10 w-[150px]" aria-label="Reclassificar ticket">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((key) => (
                <SelectItem key={key} value={key}>
                  {SEVERITY_INFO[key].label} · {SEVERITY_INFO[key].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto bg-[#F4F1EA] p-4">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              <TicketDivider code={ticket.code} label="Abertura" tone="success" />
              {/* A descrição é a primeira "mensagem" da conversa, da empresa. */}
              <ChatBubble
                mine={false}
                authorName={ticket.openedBy.name}
                isSupport={false}
                content={ticket.description}
                attachments={ticket.attachments}
                createdAt={ticket.createdAt}
              />
              {ticket.messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  mine={message.authorType === "SUPPORT"}
                  authorName={message.author.id === currentUserId ? "Você" : message.author.name}
                  isSupport={message.authorType === "SUPPORT"}
                  content={message.content}
                  attachments={message.attachments}
                  createdAt={message.createdAt}
                />
              ))}
              {ticket.status === "RESOLVED" && ticket.resolvedAt && (
                <TicketDivider code={ticket.code} label="Resolvido" tone="default" />
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-border bg-background border-t p-4">
            <form onSubmit={handleSend} className="mx-auto flex max-w-2xl flex-col gap-2">
              {picker.input}
              <PendingFileChips files={files} onChange={setFiles} disabled={sending} />
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-12 shrink-0"
                  aria-label="Anexar arquivo"
                  disabled={sending || picker.full}
                  onClick={picker.open}
                >
                  <Paperclip className="size-4" />
                </Button>
                <Textarea
                  rows={1}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter envia, Shift+Enter quebra linha (igual ao Desk).
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Responder à empresa…"
                  className="h-12 min-h-0 flex-1 resize-none"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-12 shrink-0"
                  aria-label="Enviar"
                  disabled={sending || (!content.trim() && files.length === 0)}
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div className="border-border hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l p-4 xl:flex">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <DetailRow label="Empresa">{ticket.organization.name}</DetailRow>
              <DetailRow label="Aberto por">
                {ticket.openedBy.name}
                <span className="text-muted-foreground block text-xs">{ticket.openedBy.email}</span>
              </DetailRow>
              <DetailRow label="Criado em">{formatDateTime(ticket.createdAt)}</DetailRow>
              <DetailRow label="Atualizado em">{formatDateTime(ticket.updatedAt)}</DetailRow>
              {ticket.resolvedAt && <DetailRow label="Resolvido em">{formatDateTime(ticket.resolvedAt)}</DetailRow>}
            </CardContent>
          </Card>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">Classificação</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {severity.label} · {severity.name}
              </p>
              <p className="text-muted-foreground text-xs">{severity.impact}</p>
            </CardContent>
          </Card>

          {allAttachments.length > 0 && (
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-base">Anexos ({allAttachments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <AttachmentList attachments={allAttachments} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
