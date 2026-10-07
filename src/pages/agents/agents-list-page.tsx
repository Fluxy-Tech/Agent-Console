import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { Bot, Coins, Plus, Trash2 } from "lucide-react";
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
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCan } from "@/hooks/use-can";
import { PermissionAction } from "@/domain/permission-action";
import { api, ApiError } from "@/lib/api";
import type { Agent, OrganizationTokenUsage, SeriesPeriod } from "@/types/domain";
import { formatTokens, TokenUsageOverview } from "./token-usage-overview";

export function AgentsListPage() {
  const navigate = useNavigate();
  const can = useCan();
  const canWrite = can(PermissionAction.AGENTS_WRITE);
  const { data: agents, mutate } = useSWR<Agent[]>("/api/agents");
  const [tokenPeriod, setTokenPeriod] = useState<SeriesPeriod>("current-month");
  const { data: tokenUsage } = useSWR<OrganizationTokenUsage>(`/api/agents/token-usage?period=${tokenPeriod}`);
  const tokensByAgent = new Map(tokenUsage?.agents.map((usage) => [usage.agentId, usage]));

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(agent: Agent) {
    setDeletingId(agent.id);
    try {
      await api.delete(`/api/agents/${agent.id}`);
      await mutate();
      toast.success(`Agente "${agent.name}" excluído.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o agente.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Agentes", to: "/agents" }, { label: "Lista" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Agentes</h1>
          <p className="text-muted-foreground mt-1 text-sm">Agentes de IA configurados para esta empresa.</p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate("/agents/new")}>
            <Plus className="size-4" /> Novo agente
          </Button>
        )}
      </div>

      <TokenUsageOverview
        data={tokenUsage}
        period={tokenPeriod}
        onPeriodChange={setTokenPeriod}
        totalLabel="Consumo da organização"
        chartTitle="Consumo de tokens da organização"
        chartDescription="Soma dos tokens gastos por todos os agentes desta empresa, separada por LLM. O consumo de cada agente aparece no card dele abaixo."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent) => (
          <Card
            key={agent.id}
            className="hover:border-primary/50 shadow-xl flex cursor-pointer flex-col gap-3 p-4 transition-colors"
            onClick={() => navigate(`/agents/${agent.id}`)}
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                <Bot className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{agent.name}</p>
                <p className="text-muted-foreground text-xs">
                  {agent.isActive ? "Ativo" : "Inativo"}
                </p>
              </div>
              <Badge variant={agent.isActive ? "default" : "outline"}>{agent.isActive ? "Ativo" : "Inativo"}</Badge>
              {canWrite && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                      disabled={deletingId === agent.id}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir "{agent.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Só é possível excluir um agente sem nenhuma rede social vinculada. O agente some da lista
                        e de qualquer configuração nova, mas continua aparecendo em filtros e informações de
                        contatos/campanhas antigas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => handleDelete(agent)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <AgentTokensFooter usage={tokensByAgent.get(agent.id)} loaded={!!tokenUsage} />
          </Card>
        ))}
        {agents && agents.length === 0 && (
          <p className="text-muted-foreground col-span-full text-sm">
            Nenhum agente cadastrado ainda. Crie o primeiro para começar.
          </p>
        )}
      </div>
    </div>
  );
}

/// Rodapé do card do agente com o consumo dele no período escolhido acima.
function AgentTokensFooter({
  usage,
  loaded,
}: {
  usage: OrganizationTokenUsage["agents"][number] | undefined;
  loaded: boolean;
}) {
  return (
    <div className="border-border flex items-center justify-between gap-2 border-t pt-3 text-xs">
      <span className="text-muted-foreground flex items-center gap-1.5">
        <Coins className="size-3.5" /> Tokens no período
      </span>
      {loaded ? (
        <span className="text-right">
          <span className="font-semibold">{formatTokens(usage?.total ?? 0)}</span>
          <span className="text-muted-foreground">
            {" "}
            · ADK {formatTokens(usage?.ADK ?? 0)} · OpenAI {formatTokens(usage?.OPENAI ?? 0)}
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground">…</span>
      )}
    </div>
  );
}
