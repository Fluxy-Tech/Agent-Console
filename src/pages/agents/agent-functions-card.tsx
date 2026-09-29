import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CalendarClock, Headset, SquareKanban, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import type { AgentFunction, AgentFunctionSettings, AgentFunctionType, CrmStageOption } from "@/types/domain";

/// Texto de cada função fixa — o comportamento em si fica no AI-Worker/piloto.
const FUNCTION_INFO: Record<AgentFunctionType, { title: string; description: string; icon: typeof CalendarClock }> = {
  CALENDAR_EVENT: {
    title: "Agendamento de evento",
    description:
      "Pergunta ao contato o dia e o horário, confere se algum usuário liberado no calendário (Kanban › Configurações) está livre e sem outro evento nesse horário, e agenda o evento.",
    icon: CalendarClock,
  },
  KANBAN_CARD: {
    title: "Card no Kanban",
    description:
      "Cria o card do contato no Kanban e registra nele um comentário do agente com a mensagem do contato e os dados coletados.",
    icon: SquareKanban,
  },
};

interface AgentFunctionsCardProps {
  /// undefined no modo criação — as funções pertencem a um agente já salvo.
  agentId: string | undefined;
  canWrite: boolean;
}

/// Funções fixas que o agente executa. Cada switch salva na hora (não
/// depende do botão "Salvar alterações" do agente).
export function AgentFunctionsCard({ agentId, canWrite }: AgentFunctionsCardProps) {
  const { data: functions, mutate } = useSWR<AgentFunction[]>(agentId ? `/api/agents/${agentId}/functions` : null);
  const [busyType, setBusyType] = useState<AgentFunctionType | null>(null);
  const { data: settings, mutate: mutateSettings } = useSWR<AgentFunctionSettings>(
    agentId ? `/api/agents/${agentId}/function-settings` : null,
  );
  const [savingSettings, setSavingSettings] = useState(false);

  async function handleHandoffToggle(value: boolean) {
    const next = { handoffAfterFunctions: value };
    setSavingSettings(true);
    try {
      await mutateSettings(() => api.put<AgentFunctionSettings>(`/api/agents/${agentId}/function-settings`, next), {
        optimisticData: next,
        rollbackOnError: true,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar a configuração.");
    } finally {
      setSavingSettings(false);
    }
  }

  const { data: stages } = useSWR<CrmStageOption[]>(agentId ? `/api/agents/${agentId}/crm-stages` : null);
  const defaultStage = stages?.find((s) => s.isDefault);

  function handleToggle(fn: AgentFunction, key: "runAtStart" | "runAfterMetadata", value: boolean) {
    return saveFunction(fn, { runAtStart: fn.runAtStart, runAfterMetadata: fn.runAfterMetadata, [key]: value });
  }

  /// O estágio padrão ("Início") é salvo como null — segue o padrão mesmo
  /// que ele mude de nome.
  function handleStageChange(fn: AgentFunction, stageId: string) {
    const crmStageId = stageId === defaultStage?.id ? null : stageId;
    return saveFunction(fn, { runAtStart: fn.runAtStart, runAfterMetadata: fn.runAfterMetadata, crmStageId });
  }

  async function saveFunction(fn: AgentFunction, next: Partial<AgentFunction>) {
    setBusyType(fn.type);
    try {
      await mutate(
        async (current) => {
          const saved = await api.put<AgentFunction>(`/api/agents/${agentId}/functions/${fn.type}`, next);
          return current?.map((f) => (f.type === saved.type ? saved : f));
        },
        { optimisticData: (current) => current?.map((f) => (f.type === fn.type ? { ...f, ...next } : f)) ?? [], rollbackOnError: true },
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar a função.");
    } finally {
      setBusyType(null);
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Workflow className="size-5" />
          </div>
          <div>
            <CardTitle>Funções</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Ative as funções que o agente executa na conversa e escolha em que momento cada uma roda: no início da
              conversa, depois que todos os metadados forem coletados, ou nos dois.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!agentId ? (
          <p className="text-muted-foreground text-sm">Crie o agente primeiro para configurar as funções.</p>
        ) : !functions ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : (
          functions.map((fn) => {
            const info = FUNCTION_INFO[fn.type];
            const Icon = info.icon;
            const disabled = !canWrite || busyType === fn.type;

            return (
              <div key={fn.type} className="border-border flex flex-col gap-4 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Icon className="text-primary mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{info.title}</p>
                    <p className="text-muted-foreground text-xs">{info.description}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
                  <div className="flex items-center gap-3">
                    <Switch
                      id={`fn-${fn.type}-start`}
                      checked={fn.runAtStart}
                      onCheckedChange={(v) => handleToggle(fn, "runAtStart", v)}
                      disabled={disabled}
                      className="data-[state=checked]:bg-[#25D366]"
                    />
                    <div>
                      <Label htmlFor={`fn-${fn.type}-start`} className="font-bold">
                        No início da conversa
                      </Label>
                      <p className="text-muted-foreground text-xs">Executa logo nas primeiras mensagens.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      id={`fn-${fn.type}-after`}
                      checked={fn.runAfterMetadata}
                      onCheckedChange={(v) => handleToggle(fn, "runAfterMetadata", v)}
                      disabled={disabled}
                      className="data-[state=checked]:bg-[#25D366]"
                    />
                    <div>
                      <Label htmlFor={`fn-${fn.type}-after`} className="font-bold">
                        Após coletar os metadados
                      </Label>
                      <p className="text-muted-foreground text-xs">Executa quando todos os dados forem coletados.</p>
                    </div>
                  </div>
                </div>

                {fn.type === "KANBAN_CARD" && stages && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fn-KANBAN_CARD-stage" className="font-bold">
                      Estágio de entrada do lead
                    </Label>
                    <Select
                      value={fn.crmStageId ?? defaultStage?.id ?? ""}
                      onValueChange={(v) => handleStageChange(fn, v)}
                      disabled={disabled}
                    >
                      <SelectTrigger id="fn-KANBAN_CARD-stage" className="w-full sm:w-80">
                        <SelectValue placeholder="Selecione o estágio" />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nameStage}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      Coluna do Kanban em que o card é criado. Enquanto estiver selecionado aqui, o estágio não pode ser
                      excluído.
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}

        {agentId && settings && (
          <div className="border-border flex items-start gap-3 rounded-lg border p-4">
            <Switch
              id="fn-handoff-after"
              checked={settings.handoffAfterFunctions}
              onCheckedChange={handleHandoffToggle}
              disabled={!canWrite || savingSettings}
              className="mt-0.5 data-[state=checked]:bg-[#25D366]"
            />
            <div>
              <Label htmlFor="fn-handoff-after" className="flex items-center gap-2 font-bold">
                <Headset className="text-primary size-4" />
                Enviar para o atendimento humano ao terminar
              </Label>
              <p className="text-muted-foreground text-xs">
                {settings.handoffAfterFunctions
                  ? "Depois de coletar os dados e executar as funções, o agente encaminha a conversa para um atendente."
                  : "Depois de coletar os dados e executar as funções, o agente finaliza a conversa."}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
