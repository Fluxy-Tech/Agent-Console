import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSWR, { mutate as mutateGlobal } from "swr";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip, Send } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/hooks/use-can";
import { refreshSupportUnread } from "@/hooks/use-support-unread";
import { PermissionAction } from "@/domain/permission-action";
import { api, ApiError } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";
import type { SupportTicketDetail } from "@/types/domain";
import { AttachmentList, PendingFileChips, useSupportFilePicker } from "../support/support-attachments";
import {
  SEVERITY_INFO,
  STATUS_INFO,
  SUPPORT_TICKETS_KEY,
  formatDateTime,
  uploadSupportFiles,
} from "../support/support-config";
import { ChatBubble, DetailRow, TicketDivider } from "../support/support-shared";

/// EMPRESAS — conversa de um ticket (/technical-support/:id), no estilo do
/// Desk. A empresa conversa com o time de apoio e pode encerrar o ticket;
/// status e classificação são só do time de suporte (outra tela,
/// pages/support).
export function TechnicalSupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useCan();
  const currentUserId = useAppSelector((state) => state.auth.user?.id);
  const canWrite = can(PermissionAction.SUPPORT_WRITE);

  // Atualiza sozinho a cada 10s pra resposta do apoio aparecer sem recarregar
  // a página (as URLs dos anexos duram 1h, renovadas a cada GET).
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
  // "agora" — o que chegar depois continua não lido). Só com a aba visível.
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

  async function handleResolve() {
    if (!ticket) return;
    setUpdating(true);
    try {
      await api.patch(`/api/support/tickets/${ticket.id}`, { status: "RESOLVED" });
      toast.success("Ticket encerrado.");
      await Promise.all([mutate(), mutateGlobal(SUPPORT_TICKETS_KEY)]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível encerrar o ticket.");
    } finally {
      setUpdating(false);
    }
  }

  if (error) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
        <p>Ticket não encontrado.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/technical-support")}>
          Voltar para o suporte técnico
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
          onClick={() => navigate("/technical-support")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ticket.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            Ticket #{ticket.code} · aberto por {ticket.openedBy.id === currentUserId ? "você" : ticket.openedBy.name}
          </p>
        </div>
        <Badge variant={severity.badge}>
          {severity.label} · {severity.name}
        </Badge>
        <Badge variant={status.badge}>{status.label}</Badge>
        {canWrite && ticket.status !== "RESOLVED" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:text-destructive h-10"
                disabled={updating}
              >
                Encerrar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Encerrar o ticket #{ticket.code}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Use quando o problema estiver resolvido. Se precisar, é só enviar uma nova mensagem para reabrir.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleResolve}>Encerrar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto bg-[#F4F1EA] p-4">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              <TicketDivider code={ticket.code} label="Abertura" tone="success" />
              {/* A descrição é a primeira "mensagem" da conversa, da empresa. */}
              <ChatBubble
                mine
                authorName={ticket.openedBy.id === currentUserId ? "Você" : ticket.openedBy.name}
                isSupport={false}
                content={ticket.description}
                attachments={ticket.attachments}
                createdAt={ticket.createdAt}
              />
              {ticket.messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  mine={message.authorType === "CUSTOMER"}
                  authorName={message.author.id === currentUserId ? "Você" : message.author.name}
                  isSupport={message.authorType === "SUPPORT"}
                  content={message.content}
                  attachments={message.attachments}
                  createdAt={message.createdAt}
                />
              ))}
              {ticket.messages.length === 0 && (
                <p className="text-muted-foreground text-center text-xs">
                  Ticket recebido. O time de apoio vai responder por aqui.
                </p>
              )}
              {ticket.status === "RESOLVED" && ticket.resolvedAt && (
                <TicketDivider code={ticket.code} label="Resolvido" tone="default" />
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {canWrite && (
            <div className="border-border bg-background border-t p-4">
              <form onSubmit={handleSend} className="mx-auto flex max-w-2xl flex-col gap-2">
                {ticket.status === "RESOLVED" && (
                  <p className="text-muted-foreground text-xs">
                    Este ticket está resolvido. Enviar uma nova mensagem reabre o ticket.
                  </p>
                )}
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
                    placeholder="Escreva para o time de apoio…"
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
          )}
        </div>

        <div className="border-border hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l p-4 xl:flex">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
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
