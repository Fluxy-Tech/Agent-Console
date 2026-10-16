import { useEffect, useState, type ComponentType } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import type { AgentFeature, AgentFeatureType, AgentFunction, CrmStageOption } from "@/types/domain";
import type { FormState } from "../agent-form-types";
import {
  CatalogEditor,
  cleanMediaCarousel,
  cleanReplyButtons,
  ContextualReplyEditor,
  CtaUrlEditor,
  DEFAULT_CONFIGS,
  FlowEditor,
  LinkPreviewEditor,
  ListEditor,
  LocationEditor,
  MediaCarouselEditor,
  ProductCarouselEditor,
  ReplyButtonsEditor,
  TextField,
  type Config,
  type EditorProps,
} from "./feature-editors";
import { FEATURE_BY_KEY, LIMITS } from "./feature-registry";

const EDITORS: Partial<Record<AgentFeatureType, ComponentType<EditorProps>>> = {
  CATALOG: CatalogEditor,
  PRODUCT_CAROUSEL: ProductCarouselEditor,
  CTA_URL: CtaUrlEditor,
  LIST: ListEditor,
  REPLY_BUTTONS: ReplyButtonsEditor,
  MEDIA_CAROUSEL: MediaCarouselEditor,
  LOCATION_REQUEST: LocationEditor,
  CONTEXTUAL_REPLY: ContextualReplyEditor,
  LINK_PREVIEW: LinkPreviewEditor,
  FLOW: FlowEditor,
};

const CLEANERS: Partial<Record<AgentFeatureType, (config: Config) => Config>> = {
  REPLY_BUTTONS: cleanReplyButtons,
  MEDIA_CAROUSEL: cleanMediaCarousel,
};

const PROMPT_PLACEHOLDER: Partial<Record<AgentFeatureType, string>> = {
  CATALOG: "Ex.: Quando o contato perguntar quais produtos vendemos, pedir preços ou quiser ver modelos.",
  PRODUCT_CAROUSEL: "Ex.: Quando o contato pedir sugestões ou comparar produtos parecidos.",
  CTA_URL: "Ex.: Quando o contato quiser saber mais sobre a empresa ou acessar o site.",
  LIST: "Ex.: Quando o contato perguntar sobre os planos disponíveis.",
  REPLY_BUTTONS: "Ex.: Quando precisar de uma confirmação simples, como Sim ou Não.",
  MEDIA_CAROUSEL: "Ex.: Quando o contato quiser ver exemplos do nosso trabalho.",
  LOCATION_REQUEST: "Ex.: Quando o contato quiser saber o prazo ou o valor da entrega.",
  CONTEXTUAL_REPLY: "Opcional. Ex.: Sempre que o contato mandar várias perguntas seguidas.",
  LINK_PREVIEW: "Ex.: Quando o contato pedir o link do blog ou de um artigo.",
  FLOW: "Ex.: Quando o contato quiser fazer o cadastro ou pedir um orçamento.",
};

/// Modal de adicionar/editar uma funcionalidade de mensagem (AgentFeature).
/// Salva na hora, independente do "Salvar alterações" do agente.
export function FeatureDialog({
  agentId,
  type,
  feature,
  open,
  onOpenChange,
  onSaved,
}: {
  agentId: string;
  type: AgentFeatureType;
  /// undefined = adicionando.
  feature?: AgentFeature;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const info = FEATURE_BY_KEY[type];
  const Editor = EDITORS[type];
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [config, setConfig] = useState<Config>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(feature?.name ?? info.title);
    setPrompt(feature?.prompt ?? "");
    setConfig(feature?.config ?? structuredClone(DEFAULT_CONFIGS[type] ?? {}));
    setError(null);
  }, [open, feature, type, info.title]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const body = { name: name.trim(), prompt: prompt.trim(), config: (CLEANERS[type] ?? ((c) => c))(config) };
    try {
      if (feature) await api.put(`/api/agents/${agentId}/features/${feature.id}`, body);
      else await api.post(`/api/agents/${agentId}/features`, { ...body, type });
      toast.success(feature ? "Funcionalidade atualizada." : "Funcionalidade adicionada.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a funcionalidade.");
    } finally {
      setSaving(false);
    }
  }

  const Icon = info.icon;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="text-primary size-5" /> {feature ? `Configurar ${info.title.toLowerCase()}` : `Adicionar ${info.title.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feature-name" className="font-bold">
              Nome
            </Label>
            <Input id="feature-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            <p className="text-muted-foreground text-xs">Para identificar esta funcionalidade na lista e no prompt do agente.</p>
          </div>

          <TextField
            id="feature-prompt"
            label={type === "CONTEXTUAL_REPLY" ? "Quando usar (opcional)" : "Quando o agente deve usar"}
            value={prompt}
            onChange={setPrompt}
            max={LIMITS.prompt}
            multiline
            placeholder={PROMPT_PLACEHOLDER[type]}
            hint="Esse texto vai para o prompt do agente."
          />

          {Editor && <Editor agentId={agentId} config={config} onChange={setConfig} disabled={saving} />}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={saving} type="button" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Salvando…" : feature ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/// Modal do Agendamento de evento / Card no Kanban (AgentFunction): em que
/// momento roda e, no Kanban, o estágio de entrada. Salva na hora.
export function FunctionDialog({
  agentId,
  fn,
  open,
  onOpenChange,
  onSave,
}: {
  agentId: string;
  fn: AgentFunction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (next: Partial<AgentFunction>) => Promise<void>;
}) {
  const info = FEATURE_BY_KEY[fn.type];
  const { data: stages } = useSWR<CrmStageOption[]>(fn.type === "KANBAN_CARD" ? `/api/agents/${agentId}/crm-stages` : null);
  const defaultStage = stages?.find((s) => s.isDefault);
  const [busy, setBusy] = useState(false);

  async function save(next: Partial<AgentFunction>) {
    setBusy(true);
    try {
      await onSave({ runAtStart: fn.runAtStart, runAfterMetadata: fn.runAfterMetadata, crmStageId: fn.crmStageId, ...next });
    } finally {
      setBusy(false);
    }
  }

  const Icon = info.icon;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="text-primary size-5" /> {info.title}
          </DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {[
            { key: "runAtStart" as const, label: "No início da conversa", hint: "Executa logo nas primeiras mensagens." },
            { key: "runAfterMetadata" as const, label: "Após coletar os metadados", hint: "Executa quando todos os dados forem coletados." },
          ].map((moment) => (
            <div key={moment.key} className="flex items-center gap-3">
              <Switch
                id={`fn-${fn.type}-${moment.key}`}
                checked={fn[moment.key]}
                onCheckedChange={(v) => save({ [moment.key]: v })}
                disabled={busy}
                className="data-[state=checked]:bg-[#25D366]"
              />
              <div>
                <Label htmlFor={`fn-${fn.type}-${moment.key}`} className="font-bold">
                  {moment.label}
                </Label>
                <p className="text-muted-foreground text-xs">{moment.hint}</p>
              </div>
            </div>
          ))}

          {fn.type === "KANBAN_CARD" && stages && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fn-kanban-stage" className="font-bold">
                Estágio de entrada do lead
              </Label>
              <Select
                value={fn.crmStageId ?? defaultStage?.id ?? ""}
                onValueChange={(id) => save({ crmStageId: id === defaultStage?.id ? null : id })}
                disabled={busy}
              >
                <SelectTrigger id="fn-kanban-stage" className="w-full">
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
                Coluna do Kanban em que o card é criado. Enquanto estiver selecionado aqui, o estágio não pode ser excluído.
              </p>
            </div>
          )}
          {!fn.runAtStart && !fn.runAfterMetadata && (
            <p className="text-muted-foreground text-xs">Com os dois momentos desligados, a função fica inativa.</p>
          )}
          <p className="text-muted-foreground text-xs">As alterações são salvas na hora.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const RGBS_TIMES: { key: "timeSmall" | "timeMedium" | "timeLarge"; label: string; range: string; min: number }[] = [
  { key: "timeSmall", label: "Mensagem pequena", range: "Até 40 caracteres", min: 5 },
  { key: "timeMedium", label: "Mensagem média", range: "De 41 a 100 caracteres", min: 10 },
  { key: "timeLarge", label: "Mensagem grande", range: "Acima de 100 caracteres", min: 15 },
];
const RGBS_MAX_SECONDS = 300;

/// Modal do RGBS: tempos de espera por tamanho. Salva na hora no agente e
/// atualiza o formulário da página, pro "Salvar alterações" não desfazer.
export function RgbsDialog({
  agentId,
  form,
  set,
  adding,
  open,
  onOpenChange,
}: {
  agentId: string;
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  adding: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [times, setTimes] = useState({ timeSmall: form.timeSmall, timeMedium: form.timeMedium, timeLarge: form.timeLarge });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setTimes({ timeSmall: form.timeSmall, timeMedium: form.timeMedium, timeLarge: form.timeLarge });
  }, [open, form.timeSmall, form.timeMedium, form.timeLarge]);

  const invalid = RGBS_TIMES.find((t) => !Number.isInteger(times[t.key]) || times[t.key] < t.min || times[t.key] > RGBS_MAX_SECONDS);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/api/agents/${agentId}`, { rgbsEnabled: true, ...times });
      set("rgbsEnabled", true);
      (Object.keys(times) as (keyof typeof times)[]).forEach((k) => set(k, times[k]));
      toast.success(adding ? "RGBS adicionado." : "RGBS atualizado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar o RGBS.");
    } finally {
      setSaving(false);
    }
  }

  const info = FEATURE_BY_KEY.RGBS;
  const Icon = info.icon;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="text-primary size-5" /> RGBS
          </DialogTitle>
          <DialogDescription>
            Receives, Generates, Breaks and Sends: o agente divide a resposta em mensagens curtas e envia uma de cada vez,
            esperando antes de cada uma um tempo de acordo com o tamanho dela.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {RGBS_TIMES.map((t) => {
            const value = times[t.key];
            const bad = !Number.isInteger(value) || value < t.min || value > RGBS_MAX_SECONDS;
            return (
              <div key={t.key} className="border-border flex flex-col gap-2 rounded-lg border p-3">
                <div>
                  <Label htmlFor={`rgbs-${t.key}`} className="text-sm font-semibold">
                    {t.label}
                  </Label>
                  <p className="text-muted-foreground text-xs">{t.range}</p>
                </div>
                <Input
                  id={`rgbs-${t.key}`}
                  type="number"
                  min={t.min}
                  max={RGBS_MAX_SECONDS}
                  value={Number.isNaN(value) ? "" : value}
                  onChange={(e) => setTimes({ ...times, [t.key]: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
                  aria-invalid={bad}
                />
                <p className={bad ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>Mínimo de {t.min} segundos.</p>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={saving} type="button" onClick={handleSave} disabled={saving || Boolean(invalid)}>
            {saving ? "Salvando…" : adding ? "Adicionar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
