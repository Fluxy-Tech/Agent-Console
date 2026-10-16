import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Headset, Plus, Settings2, Trash2, Workflow } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AgentFeature, AgentFeatureType, AgentFunction, AgentFunctionSettings, AgentFunctionType } from "@/types/domain";
import type { FormState } from "../agent-form-types";
import { FeatureDialog, FunctionDialog, RgbsDialog } from "./feature-dialogs";
import { FEATURE_BY_KEY, FEATURE_GROUPS, FEATURES, type FeatureInfo, type FeatureKey } from "./feature-registry";

/// Item da lista "adicionadas" — junta as três origens (função, RGBS e
/// funcionalidade de mensagem) num formato só.
interface AddedItem {
  id: string;
  key: FeatureKey;
  name: string;
  badges: string[];
  fn?: AgentFunction;
  feature?: AgentFeature;
}

type Open =
  | { kind: "picker" }
  | { kind: "feature"; type: AgentFeatureType; feature?: AgentFeature }
  | { kind: "function"; type: AgentFunctionType }
  | { kind: "rgbs"; adding: boolean }
  | null;

function featureBadges(feature: AgentFeature): string[] {
  const c = feature.config as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  switch (feature.type) {
    case "CATALOG":
      return [s(c.catalogName) || "Catálogo"];
    case "PRODUCT_CAROUSEL":
      return [
        s(c.catalogName) || "Catálogo",
        c.source === "manual" ? `${(c.productIds as string[]).length} produtos fixos` : c.source === "integration" ? "Sistema da empresa" : "IA escolhe",
      ];
    case "CTA_URL":
      return [s(c.displayText), s(c.url)];
    case "LIST": {
      const rows = (c.sections as { rows: unknown[] }[]).reduce((n, sec) => n + sec.rows.length, 0);
      return [`${rows} opções`];
    }
    case "REPLY_BUTTONS":
      return [c.mode === "fixed" ? (c.buttons as string[]).join(" | ") : "Botões criados pela IA"];
    case "MEDIA_CAROUSEL":
      return [c.source === "integration" ? "Sistema da empresa" : `${(c.cards as unknown[]).length} cards`];
    case "LINK_PREVIEW":
      return [s(c.url)];
    case "FLOW":
      return [
        s(c.flowName) || "Flow",
        c.status === "DRAFT" ? "Rascunho" : c.status === "PUBLISHED" ? "Publicado" : "Indisponível",
        c.saveAsMetadata ? "Salva metadados" : "Não salva metadados",
      ];
    default:
      return [];
  }
}

/// Funcionalidades do agente: funções (agendamento/Kanban), mensagens
/// interativas, catálogo e recursos de mensagem. Tudo salva na hora.
export function FeaturesCard({
  agentId,
  canWrite,
  form,
  set,
}: {
  agentId: string | undefined;
  canWrite: boolean;
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const { data: functions, mutate: mutateFunctions } = useSWR<AgentFunction[]>(agentId ? `/api/agents/${agentId}/functions` : null);
  const { data: features, mutate: mutateFeatures } = useSWR<AgentFeature[]>(agentId ? `/api/agents/${agentId}/features` : null);
  const { data: settings, mutate: mutateSettings } = useSWR<AgentFunctionSettings>(
    agentId ? `/api/agents/${agentId}/function-settings` : null,
  );
  const [open, setOpen] = useState<Open>(null);
  const [removing, setRemoving] = useState<AddedItem | null>(null);
  const [busy, setBusy] = useState(false);

  if (!agentId) {
    return (
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Funcionalidades</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Crie o agente primeiro para adicionar funcionalidades.</p>
        </CardContent>
      </Card>
    );
  }

  const added: AddedItem[] = [
    ...(functions ?? [])
      .filter((fn) => fn.runAtStart || fn.runAfterMetadata)
      .map((fn) => ({
        id: fn.type,
        key: fn.type,
        name: FEATURE_BY_KEY[fn.type].title,
        badges: [fn.runAtStart && "No início da conversa", fn.runAfterMetadata && "Após coletar os metadados"].filter(Boolean) as string[],
        fn,
      })),
    ...(features ?? [])
      .filter((f) => f.type !== "PAYMENT")
      .map((f) => ({ id: f.id, key: f.type, name: f.name, badges: featureBadges(f).filter(Boolean), feature: f })),
    ...(form.rgbsEnabled
      ? [{ id: "RGBS", key: "RGBS" as const, name: "RGBS", badges: [`${form.timeSmall}s / ${form.timeMedium}s / ${form.timeLarge}s`] }]
      : []),
  ];
  const addedKeys = new Set(added.map((a) => a.key));

  async function saveFunction(type: AgentFunctionType, next: Partial<AgentFunction>) {
    try {
      const saved = await api.put<AgentFunction>(`/api/agents/${agentId}/functions/${type}`, next);
      await mutateFunctions((current) => current?.map((f) => (f.type === type ? saved : f)), { revalidate: false });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar a função.");
      throw err;
    }
  }

  async function handlePick(info: FeatureInfo) {
    if (info.kind === "function") {
      const type = info.key as AgentFunctionType;
      const fn = functions?.find((f) => f.type === type);
      try {
        await saveFunction(type, { runAtStart: false, runAfterMetadata: true, crmStageId: fn?.crmStageId ?? null });
        setOpen({ kind: "function", type });
      } catch {
        setOpen(null);
      }
    } else if (info.kind === "rgbs") {
      setOpen({ kind: "rgbs", adding: true });
    } else {
      setOpen({ kind: "feature", type: info.key as AgentFeatureType });
    }
  }

  function handleConfigure(item: AddedItem) {
    if (item.fn) setOpen({ kind: "function", type: item.fn.type });
    else if (item.key === "RGBS") setOpen({ kind: "rgbs", adding: false });
    else if (item.feature) setOpen({ kind: "feature", type: item.feature.type, feature: item.feature });
  }

  async function handleRemove(item: AddedItem) {
    setBusy(true);
    try {
      if (item.fn) {
        await saveFunction(item.fn.type, { runAtStart: false, runAfterMetadata: false, crmStageId: item.fn.crmStageId });
      } else if (item.key === "RGBS") {
        await api.put(`/api/agents/${agentId}`, { rgbsEnabled: false });
        set("rgbsEnabled", false);
      } else if (item.feature) {
        await api.delete(`/api/agents/${agentId}/features/${item.feature.id}`);
        await mutateFeatures();
      }
      toast.success("Funcionalidade removida.");
    } catch (err) {
      if (!item.fn) toast.error(err instanceof ApiError ? err.message : "Não foi possível remover a funcionalidade.");
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  }

  async function handleHandoffToggle(value: boolean) {
    const next = { handoffAfterFunctions: value };
    try {
      await mutateSettings(() => api.put<AgentFunctionSettings>(`/api/agents/${agentId}/function-settings`, next), {
        optimisticData: next,
        rollbackOnError: true,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar a configuração.");
    }
  }

  const openFunction = open?.kind === "function" ? functions?.find((f) => f.type === open.type) : undefined;

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex flex-1 items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Workflow className="size-5" />
            </div>
            <div>
              <CardTitle>Funcionalidades</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                O que o agente faz e envia na conversa: funções, mensagens interativas, catálogo e recursos de mensagem.
                Cada funcionalidade tem a sua descrição de quando usar.
              </p>
            </div>
          </div>
          {canWrite && (
            <Button type="button" size="sm" className="w-fit" onClick={() => setOpen({ kind: "picker" })}>
              <Plus className="size-4" /> Adicionar funcionalidade
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!functions || !features ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : added.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed p-6 text-center text-sm">
            Nenhuma funcionalidade adicionada. Clique em "Adicionar funcionalidade" para começar.
          </p>
        ) : (
          added.map((item) => {
            const info = FEATURE_BY_KEY[item.key];
            const Icon = info.icon;
            return (
              <div key={item.id} className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="text-sm font-semibold">
                      {item.name}
                      {item.name !== info.title && <span className="text-muted-foreground font-normal"> · {info.title}</span>}
                    </p>
                    {item.feature?.prompt && <p className="text-muted-foreground line-clamp-2 text-xs">Quando usar: {item.feature.prompt}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {item.badges.map((b) => (
                        <Badge key={b} variant="secondary" className="max-w-full truncate">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {canWrite && (
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleConfigure(item)}>
                      <Settings2 className="size-4" /> Configurar
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setRemoving(item)} aria-label="Remover">
                      <Trash2 className="text-destructive size-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {settings && (
          <div className="border-border flex items-start gap-3 rounded-lg border p-4">
            <Switch
              id="fn-handoff-after"
              checked={settings.handoffAfterFunctions}
              onCheckedChange={handleHandoffToggle}
              disabled={!canWrite}
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

      <Dialog open={open?.kind === "picker"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Adicionar funcionalidade</DialogTitle>
            <DialogDescription>Escolha o que o agente vai poder fazer. Depois você configura quando ele deve usar.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            {FEATURE_GROUPS.map((group) => (
              <div key={group} className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs font-medium uppercase">{group}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FEATURES.filter((f) => f.group === group).map((info) => {
                    const taken = Boolean(info.single && addedKeys.has(info.key));
                    const Icon = info.icon;
                    return (
                      <button
                        key={info.key}
                        type="button"
                        disabled={taken}
                        onClick={() => handlePick(info)}
                        className={cn(
                          "border-border flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                          taken ? "cursor-not-allowed opacity-50" : "hover:border-primary/50 hover:bg-accent/40",
                        )}
                      >
                        <Icon className="text-primary mt-0.5 size-5 shrink-0" />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold">{info.title}</span>
                          <span className="text-muted-foreground text-xs">{taken ? "Já adicionada." : info.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {open?.kind === "feature" && (
        <FeatureDialog
          agentId={agentId}
          type={open.type}
          feature={open.feature}
          open
          onOpenChange={(o) => !o && setOpen(null)}
          onSaved={() => mutateFeatures()}
        />
      )}

      {openFunction && (
        <FunctionDialog
          agentId={agentId}
          fn={openFunction}
          open
          onOpenChange={(o) => !o && setOpen(null)}
          onSave={(next) => saveFunction(openFunction.type, next)}
        />
      )}

      {open?.kind === "rgbs" && (
        <RgbsDialog agentId={agentId} form={form} set={set} adding={open.adding} open onOpenChange={(o) => !o && setOpen(null)} />
      )}

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{removing?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>O agente deixa de usar esta funcionalidade na hora.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={() => removing && handleRemove(removing)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
