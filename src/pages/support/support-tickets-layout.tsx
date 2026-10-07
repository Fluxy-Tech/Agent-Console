import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { MessageSquareDashed, Paperclip, Search, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SupportTicketStatus, SupportTicketSummary } from "@/types/domain";
import { SEVERITY_INFO, STATUS_INFO, STATUSES, SUPPORT_TICKETS_KEY } from "./support-config";
import { BrowserNotificationsButton, formatListTime } from "./support-shared";

type StatusFilter = SupportTicketStatus | "ALL";

const FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: "Todos",
  OPEN: "Abertos",
  IN_PROGRESS: "Em atendimento",
  WAITING_CUSTOMER: "Aguardando",
  RESOLVED: "Resolvidos",
};

/// Prévia do ponto de vista de quem atende: "Você" = o próprio time.
function previewOf(ticket: SupportTicketSummary): string {
  const last = ticket.lastMessage;
  if (!last) return "Aguardando primeira resposta";
  const who = last.authorType === "SUPPORT" ? "Você" : "Empresa";
  const text = last.content.trim() || (last.attachmentCount > 0 ? `📎 ${last.attachmentCount} anexo(s)` : "");
  return `${who}: ${text}`;
}

/// TIME DE SUPORTE — Tickets (/support), no estilo do Desk: lista dos
/// tickets de todas as empresas (dentro das classificações da pessoa) fixa à
/// esquerda e a conversa no <Outlet/>. A área das empresas é outra tela
/// (pages/technical-support). No celular, a lista some com um ticket aberto.
export function SupportTicketsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTicketId = location.pathname.match(/^\/support\/([^/]+)$/)?.[1];

  const { data: tickets } = useSWR<SupportTicketSummary[]>(SUPPORT_TICKETS_KEY, { refreshInterval: 15000 });

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

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
        (!term ||
          ticket.title.toLowerCase().includes(term) ||
          String(ticket.code).includes(term.replace("#", "")) ||
          ticket.organization.name.toLowerCase().includes(term)),
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
            <Ticket className="text-primary size-5" />
            <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold">Tickets</h1>
          </div>
          <BrowserNotificationsButton />
        </div>

        <div className="border-border flex flex-col gap-2 border-b p-3">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar título, número ou empresa"
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
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
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
              {tickets.length === 0 ? "Nenhum ticket nas suas classificações ainda." : "Nenhum ticket com esses filtros."}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((ticket) => {
                const isActive = activeTicketId === ticket.id;
                const isUnread = ticket.unreadCount > 0 || ticket.isNew;
                const severity = SEVERITY_INFO[ticket.severity];
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => navigate(`/support/${ticket.id}`)}
                    className={cn(
                      "flex w-full flex-col items-start gap-1 rounded-md border p-3 text-left transition-all hover:-translate-y-0.5",
                      isActive ? "border-primary/30 bg-primary/5 shadow-lg" : "border-transparent hover:shadow-md",
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {isUnread && <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="Não lido" />}
                        <span className={cn("truncate text-sm", isUnread ? "font-semibold" : "font-medium")}>
                          {ticket.organization.name}
                        </span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-[11px]">
                        {formatListTime(ticket.lastMessage?.createdAt ?? ticket.createdAt)}
                      </span>
                    </span>
                    <span className="w-full truncate text-xs font-medium">{ticket.title}</span>
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
                      {ticket.unreadCount > 0 ? (
                        <span className="bg-primary text-primary-foreground ml-auto min-w-5 rounded-full px-1.5 text-center text-[10px] leading-5 font-semibold">
                          {ticket.unreadCount}
                        </span>
                      ) : (
                        ticket.isNew && (
                          <Badge variant="destructive" className="ml-auto px-1.5 py-0 text-[10px]">
                            Novo
                          </Badge>
                        )
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
    </div>
  );
}

/// Nenhum ticket selecionado (rota /support).
export function SupportEmptyState() {
  return (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full">
        <Ticket className="size-7" />
      </div>
      <p className="text-foreground text-sm font-medium">Selecione um ticket</p>
      <p className="max-w-sm text-xs">Escolha um ticket na lista para ver a conversa com a empresa e responder.</p>
    </div>
  );
}
