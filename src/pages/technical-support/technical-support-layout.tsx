import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { LifeBuoy, MessageSquareDashed, Paperclip, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCan } from "@/hooks/use-can";
import { PermissionAction } from "@/domain/permission-action";
import { cn } from "@/lib/utils";
import type { SupportTicketStatus, SupportTicketSummary } from "@/types/domain";
import { NewTicketDialog } from "../support/new-ticket-dialog";
import { SEVERITY_INFO, STATUS_INFO, STATUSES, SUPPORT_TICKETS_KEY } from "../support/support-config";
import { BrowserNotificationsButton, formatListTime } from "../support/support-shared";

type StatusFilter = SupportTicketStatus | "ALL";

const FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: "Todos",
  OPEN: "Abertos",
  IN_PROGRESS: "Em atendimento",
  WAITING_CUSTOMER: "Aguardando você",
  RESOLVED: "Resolvidos",
};

/// Prévia do ponto de vista da empresa: "Você" = alguém da própria empresa.
function previewOf(ticket: SupportTicketSummary): string {
  const last = ticket.lastMessage;
  if (!last) return "Aguardando resposta do time de apoio";
  const who = last.authorType === "CUSTOMER" ? "Você" : "Apoio";
  const text = last.content.trim() || (last.attachmentCount > 0 ? `📎 ${last.attachmentCount} anexo(s)` : "");
  return `${who}: ${text}`;
}

/// EMPRESAS — Suporte técnico (/technical-support): os tickets da empresa
/// ativa, no mesmo estilo do Desk, com a abertura de tickets. A área de quem
/// atende é outra tela (pages/support). No celular, a lista some com um
/// ticket aberto.
export function TechnicalSupportLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTicketId = location.pathname.match(/^\/technical-support\/([^/]+)$/)?.[1];

  const can = useCan();
  const canOpen = can(PermissionAction.SUPPORT_WRITE);

  const { data: tickets, mutate } = useSWR<SupportTicketSummary[]>(SUPPORT_TICKETS_KEY, { refreshInterval: 15000 });

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { ALL: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_CUSTOMER: 0, RESOLVED: 0 };
    for (const ticket of tickets ?? []) {
      result[ticket.status] += 1;
      result.ALL += 1;
    }
    return result;
  }, [tickets]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (tickets ?? []).filter(
      (ticket) =>
        (filter === "ALL" || ticket.status === filter) &&
        (!term || ticket.title.toLowerCase().includes(term) || String(ticket.code).includes(term.replace("#", ""))),
    );
  }, [tickets, filter, search]);

  return (
    <div className="flex h-full min-h-0">
      <aside
        className={cn(
          "bg-background/60 border-border w-full shrink-0 flex-col border-r md:flex md:w-80",
          activeTicketId ? "hidden" : "flex",
        )}
      >
        <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <LifeBuoy className="text-primary size-5" />
            <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold">Suporte técnico</h1>
          </div>
          <div className="flex items-center gap-1">
            <BrowserNotificationsButton />
            {canOpen && (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" /> Abrir
              </Button>
            )}
          </div>
        </div>

        <div className="border-border flex flex-col gap-2 border-b p-3">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar título ou número"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(["ALL", ...STATUSES] as StatusFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-sm border px-2.5 py-1 text-xs transition-colors",
                  filter === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {FILTER_LABELS[key]} <span className="opacity-70">{counts[key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {!tickets ? (
            <p className="text-muted-foreground py-8 text-center text-xs">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-10 text-center text-xs">
              <MessageSquareDashed className="size-6" />
              {tickets.length === 0
                ? "Nenhum ticket aberto ainda. Precisa de ajuda? Abra o primeiro."
                : "Nenhum ticket com esses filtros."}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((ticket) => {
                const isActive = activeTicketId === ticket.id;
                const isUnread = ticket.unreadCount > 0;
                const severity = SEVERITY_INFO[ticket.severity];
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => navigate(`/technical-support/${ticket.id}`)}
                    className={cn(
                      "flex w-full flex-col items-start gap-1 rounded-md border p-3 text-left transition-all hover:-translate-y-0.5",
                      isActive ? "border-primary/30 bg-primary/5 shadow-lg" : "border-transparent hover:shadow-md",
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {isUnread && <span className="bg-primary size-2 shrink-0 rounded-sm" aria-label="Não lido" />}
                        <span className={cn("truncate text-sm", isUnread ? "font-semibold" : "font-medium")}>
                          {ticket.title}
                        </span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-[11px]">
                        {formatListTime(ticket.lastMessage?.createdAt ?? ticket.createdAt)}
                      </span>
                    </span>
                    <span className="text-muted-foreground flex w-full items-center gap-1 text-xs">
                      {ticket.lastMessage && ticket.lastMessage.attachmentCount > 0 && !ticket.lastMessage.content.trim() && (
                        <Paperclip className="size-3 shrink-0" />
                      )}
                      <span className="truncate">{previewOf(ticket)}</span>
                    </span>
                    <span className="flex w-full items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground">#{ticket.code}</span>
                      <Badge variant={severity.badge} className="px-1.5 py-0 text-[10px]">
                        {severity.label}
                      </Badge>
                      <span className="text-muted-foreground truncate">{STATUS_INFO[ticket.status].label}</span>
                      {ticket.unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground ml-auto min-w-5 rounded-sm px-1.5 text-center text-[10px] leading-5 font-semibold">
                          {ticket.unreadCount}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <div className={cn("min-w-0 flex-1 flex-col", activeTicketId ? "flex" : "hidden md:flex")}>
        <Outlet />
      </div>

      <NewTicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(ticketId) => {
          setDialogOpen(false);
          void mutate();
          navigate(`/technical-support/${ticketId}`);
        }}
      />
    </div>
  );
}

/// Nenhum ticket selecionado (rota /technical-support).
export function TechnicalSupportEmptyState() {
  return (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-sm">
        <LifeBuoy className="size-7" />
      </div>
      <p className="text-foreground text-sm font-medium">Selecione um ticket</p>
      <p className="max-w-sm text-xs">
        Escolha um ticket na lista para ver a conversa com o time de apoio, ou abra um novo pelo botão "Abrir".
      </p>
    </div>
  );
}
