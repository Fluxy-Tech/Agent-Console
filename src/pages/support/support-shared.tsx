import { useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCircle2, Headset, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SupportAttachment } from "@/types/domain";
import { AttachmentList } from "./support-attachments";
import { formatDateTime } from "./support-config";

/// Peças visuais usadas pelas DUAS áreas de tickets — a do time de suporte
/// (/support) e a das empresas (/technical-support). As telas são separadas
/// de propósito (cada lado evolui sozinho); só o visual comum mora aqui.

/// Mesmo formato da lista do Desk: "Agora" pro que acabou de chegar, hora
/// pro que é de hoje, data curta pro resto.
export function formatListTime(iso: string): string {
  const date = new Date(iso);
  if (Date.now() - date.getTime() < 60_000) return "Agora";
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/// Balão no padrão do Desk: quem está vendo (o próprio lado) fica à direita
/// em verde WhatsApp; o outro lado, à esquerda em branco.
export function ChatBubble({
  mine,
  authorName,
  isSupport,
  content,
  attachments,
  createdAt,
}: {
  mine: boolean;
  authorName: string;
  isSupport: boolean;
  content: string;
  attachments: SupportAttachment[];
  createdAt: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-2 rounded-2xl px-4 py-2 text-sm text-black shadow-lg shadow-black/10",
          mine ? "rounded-tr-none bg-[#D6FDD0]" : "rounded-tl-none bg-white",
        )}
      >
        {content && <p className="break-words whitespace-pre-wrap">{content}</p>}
        <AttachmentList attachments={attachments} />
      </div>
      <p className="text-muted-foreground flex items-center gap-1 px-1 text-[10px]">
        {formatDateTime(createdAt)} · {isSupport && <Headset className="size-3" />}
        {authorName}
        {isSupport && " (apoio)"}
      </p>
    </div>
  );
}

/// Marcador de abertura/resolução no meio da conversa — mesmo visual do
/// TicketDivider do Desk.
export function TicketDivider({ code, label, tone }: { code: number; label: string; tone: "success" | "default" }) {
  return (
    <div className="my-2 flex items-center gap-3">
      <div className="border-border h-px flex-1 border-t" />
      <Badge variant={tone} className="shrink-0 gap-1.5 px-3 py-1 text-xs font-semibold">
        {tone === "success" ? <LogIn className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
        Ticket #{code} · {label}
      </Badge>
      <div className="border-border h-px flex-1 border-t" />
    </div>
  );
}

export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm break-words">{children}</span>
    </div>
  );
}

/// Notificação do navegador (aviso com a aba em segundo plano) depende da
/// permissão do próprio navegador — o botão só aparece enquanto a pessoa
/// ainda não respondeu ao pedido. Quem mostra a notificação é o
/// SupportNotifier do AppShell.
export function BrowserNotificationsButton() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState(supported ? Notification.permission : "denied");

  if (!supported || permission !== "default") return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Ativar notificações do navegador"
      title="Ativar notificações do navegador"
      onClick={async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === "granted") toast.success("Pronto! Você será avisado mesmo com a aba em segundo plano.");
      }}
    >
      <Bell className="size-4" />
    </Button>
  );
}
