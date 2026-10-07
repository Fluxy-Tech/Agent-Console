import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useIsSupportTeam } from "@/hooks/use-can";
import { useSupportUnread } from "@/hooks/use-support-unread";
import { useAppSelector } from "@/store/hooks";
import type { SupportUnread } from "@/types/domain";

type Snapshot = Map<string, { unreadCount: number; isNew: boolean }>;

function snapshotOf(data: SupportUnread): Snapshot {
  return new Map(data.items.map((item) => [item.ticketId, { unreadCount: item.unreadCount, isNew: item.isNew }]));
}

/// Avisos de mensagem nova do suporte técnico, montado uma vez no AppShell:
/// - toast "Nova mensagem no chamado #42" com botão pra abrir;
/// - notificação do navegador quando a aba está em segundo plano (se a
///   pessoa permitiu — ver botão na tela de Suporte técnico);
/// - contador no título da aba, ex: "(2) Sturnus Flow".
/// Só avisa o que MUDOU desde a última consulta — a primeira carga (login,
/// F5, troca de empresa) só registra o estado, senão toda não lida antiga
/// viraria toast de novo.
export function SupportNotifier() {
  const { data } = useSupportUnread();
  const location = useLocation();
  const navigate = useNavigate();
  const isSupportTeam = useIsSupportTeam();
  const companyId = useAppSelector((state) => state.activeCompany?.id);

  const previous = useRef<Snapshot | null>(null);
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  // Troca de empresa = outro conjunto de chamados; recomeça sem avisar.
  useEffect(() => {
    previous.current = null;
  }, [companyId]);

  useEffect(() => {
    if (!data) return;
    const before = previous.current;
    previous.current = snapshotOf(data);
    if (!before) return;

    for (const item of data.items) {
      const old = before.get(item.ticketId);
      const gotNewMessage = item.unreadCount > (old?.unreadCount ?? 0);
      const becameNew = item.isNew && !old?.isNew;
      if (!gotNewMessage && !becameNew) continue;

      // Quem já está com o chamado aberto (e olhando a aba) vê a mensagem
      // chegar ali mesmo.
      // Cada lado tem a própria tela de tickets.
      const ticketPath = `${isSupportTeam ? "/support" : "/technical-support"}/${item.ticketId}`;
      if (pathnameRef.current === ticketPath && !document.hidden) continue;

      const title = becameNew && !gotNewMessage ? `Novo chamado #${item.code}` : `Nova mensagem no chamado #${item.code}`;
      const description = isSupportTeam ? item.title : `${item.title} — resposta do time de apoio`;

      toast.info(title, {
        id: `support-${item.ticketId}`,
        description,
        duration: 10000,
        action: { label: "Abrir", onClick: () => navigate(ticketPath) },
      });

      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(title, { body: description, tag: `support-${item.ticketId}` });
        notification.onclick = () => {
          window.focus();
          navigate(ticketPath);
          notification.close();
        };
      }
    }
  }, [data, navigate, isSupportTeam]);

  // Contador no título da aba.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    const count = data?.tickets ?? 0;
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [data?.tickets]);

  useEffect(
    () => () => {
      document.title = document.title.replace(/^\(\d+\)\s*/, "");
    },
    [],
  );

  return null;
}
