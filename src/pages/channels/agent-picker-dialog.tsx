import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Bot, ListChecks, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Agent, Channel } from "@/types/domain";
import { DefaultQueueDialog } from "./default-queue-dialog";

interface AgentPickerProps {
  channel: Channel;
  disabled: boolean;
  onSaved: () => void;
}

/// Lista de agentes embutida direto no card "Agentes" — sem passar por um
/// botão pra abrir. O ativo aparece destacado num tom mais claro; clicar em
/// qualquer outro pede confirmação antes de trocar de verdade (é uma troca
/// imediata, sem botão "Salvar" à parte).
export function AgentPicker({ channel, disabled, onSaved }: AgentPickerProps) {
  const { data: agents } = useSWR<Agent[]>("/api/agents");

  const [pendingAgent, setPendingAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [openAgentSaving, setOpenAgentSaving] = useState(false);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);

  async function confirmChange() {
    if (!pendingAgent) return;
    setSaving(true);
    try {
      await api.put(`/api/channels/${channel.id}`, { agentId: pendingAgent.id });
      onSaved();
      toast.success(`Agente alterado para "${pendingAgent.name}".`);
      setPendingAgent(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível trocar o agente.");
    } finally {
      setSaving(false);
    }
  }

  /// Liga/desliga o roteamento pro agente de IA deste canal (openAgent). Só
  /// pode virar true com um agente vinculado — o Agent-Api também valida
  /// isso, aqui só evita a chamada óbvia que já sabemos que vai falhar.
  async function handleToggleOpenAgent(checked: boolean) {
    setOpenAgentSaving(true);
    try {
      await api.put(`/api/channels/${channel.id}`, { openAgent: checked });
      onSaved();
      toast.success(checked ? "Agente ativado para este canal." : "Agente desativado para este canal.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível alterar o agente ativo.");
    } finally {
      setOpenAgentSaving(false);
    }
  }

  /// Só bloqueia TROCAR de agente com o atendimento desativado — a primeira
  /// escolha (canal ainda sem agentId) continua liberada, senão um canal
  /// novo nunca conseguiria satisfazer a condição pra ligar o Switch abaixo.
  const agentListLocked = !channel.openAgent && !!channel.agentId;

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={channel.openAgent}
            disabled={disabled || openAgentSaving || (!channel.openAgent && !channel.agentId)}
            onCheckedChange={handleToggleOpenAgent}
            className="data-[state=checked]:bg-success"
          />
          <div>
            <p className="text-sm font-medium">Ativo para este canal</p>
            <p className="text-muted-foreground text-xs">
              {channel.openAgent
                ? "Mensagens recebidas vão pro agente de IA selecionado abaixo."
                : "Mensagens recebidas vão direto pro atendimento humano."}
            </p>
            {!channel.openAgent && !channel.agentId && (
              <p className="text-muted-foreground text-xs">Selecione um agente abaixo para poder ativar.</p>
            )}
          </div>
        </div>

        {!channel.openAgent && (
          <div className="border-border flex items-center justify-between gap-3 border-t pt-3">
            <div className="flex min-w-0 items-center gap-2">
              <ListChecks className="text-muted-foreground size-4 shrink-0" />
              <p className="text-muted-foreground truncate text-xs">
                {channel.idServiceIslandDefault ? "Fila de encaminhamento selecionada" : "Nenhuma fila selecionada"}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setQueueDialogOpen(true)}>
              <Pencil className="size-3.5" /> Escolher fila
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium">Defina o agente que vai atender esse canal</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Escolha qual agente de IA conduz as conversas quando o atendimento automático estiver ativo.
          {agentListLocked && " Ative o atendimento acima para poder trocar de agente."}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {agents?.map((agent) => {
          const isCurrent = agent.id === channel.agentId;
          return (
            <button
              key={agent.id}
              type="button"
              disabled={disabled || isCurrent || agentListLocked}
              onClick={() => setPendingAgent(agent)}
              className={cn(
                "border-border flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                isCurrent ? "bg-primary/5 border-primary/30" : "hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{agent.name}</p>
              </div>
              {isCurrent && <Badge className="bg-primary/10 text-primary border-transparent shrink-0">Atual</Badge>}
            </button>
          );
        })}
        {agents && agents.length === 0 && (
          <p className="text-muted-foreground py-2 text-center text-sm">Nenhum agente cadastrado.</p>
        )}
        {!agents && <p className="text-muted-foreground py-2 text-center text-sm">Carregando agentes…</p>}
      </div>

      <DefaultQueueDialog channel={channel} open={queueDialogOpen} onOpenChange={setQueueDialogOpen} onSaved={onSaved} />

      <AlertDialog open={pendingAgent !== null} onOpenChange={(v) => !v && setPendingAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar o agente deste canal?</AlertDialogTitle>
            <AlertDialogDescription>
              O canal <strong>{channel.displayNumber}</strong> passa a ser atendido por{" "}
              <strong>{pendingAgent?.name}</strong> a partir de agora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={confirmChange}>
              {saving ? "Trocando…" : "Trocar agente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
