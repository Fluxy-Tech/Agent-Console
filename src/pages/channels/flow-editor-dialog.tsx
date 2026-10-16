import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";

export interface FlowValidationError {
  error: string;
  message: string;
  line_start?: number;
  column_start?: number;
}

export interface WhatsappFlow {
  id: string;
  name: string;
  status: string;
  categories: string[];
  validation_errors: FlowValidationError[];
  updated_at?: string;
}

export const FLOW_CATEGORY_LABELS: Record<string, string> = {
  SIGN_UP: "Cadastro",
  SIGN_IN: "Login",
  APPOINTMENT_BOOKING: "Agendamento",
  LEAD_GENERATION: "Captação de leads",
  SHOPPING: "Compras",
  CONTACT_US: "Fale conosco",
  CUSTOMER_SUPPORT: "Suporte ao cliente",
  SURVEY: "Pesquisa",
  OTHER: "Outro",
};

/// Ponto de partida de um flow novo: uma tela de cadastro com nome e e-mail
/// (validado na Meta sem erros).
export const DEFAULT_FLOW_JSON = JSON.stringify(
  {
    version: "7.1",
    screens: [
      {
        id: "CADASTRO",
        title: "Cadastro",
        terminal: true,
        success: true,
        data: {},
        layout: {
          type: "SingleColumnLayout",
          children: [
            { type: "TextHeading", text: "Conte um pouco sobre você" },
            { type: "TextInput", name: "nome", label: "Nome", "input-type": "text", required: true },
            { type: "TextInput", name: "email", label: "E-mail", "input-type": "email", required: false },
            {
              type: "Footer",
              label: "Enviar",
              "on-click-action": { name: "complete", payload: { nome: "${form.nome}", email: "${form.email}" } },
            },
          ],
        },
      },
    ],
  },
  null,
  2,
);

function parseError(json: string): string | null {
  try {
    JSON.parse(json);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "JSON inválido.";
  }
}

/// Criar ou editar (rascunho) um WhatsApp Flow. Salvar manda o JSON pra Meta,
/// que valida na hora; com erros, o flow fica salvo como rascunho e o modal
/// continua aberto mostrando cada erro.
export function FlowEditorDialog({
  channelId,
  flow,
  initialJson,
  open,
  onOpenChange,
  onSaved,
}: {
  channelId: string;
  /// undefined = novo flow.
  flow?: WhatsappFlow;
  initialJson?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [json, setJson] = useState(DEFAULT_FLOW_JSON);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaErrors, setMetaErrors] = useState<FlowValidationError[]>([]);
  const [savedId, setSavedId] = useState<string | undefined>(flow?.id);

  useEffect(() => {
    if (!open) return;
    setName(flow?.name ?? "");
    setCategories(flow?.categories ?? ["LEAD_GENERATION"]);
    setJson(initialJson ? prettify(initialJson) : DEFAULT_FLOW_JSON);
    setMetaErrors(flow?.validation_errors ?? []);
    setSavedId(flow?.id);
    setError(null);
  }, [open, flow, initialJson]);

  const jsonError = parseError(json);

  function prettify(value: string) {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  function toggleCategory(value: string, checked: boolean) {
    setCategories((current) => (checked ? [...current, value] : current.filter((c) => c !== value)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = { name: name.trim(), categories, flowJson: json };
      // Depois do primeiro salvar (mesmo com erros), as próximas tentativas
      // editam o mesmo rascunho em vez de criar outro.
      const result = savedId
        ? await api.put<{ id: string; validationErrors: FlowValidationError[] }>(`/api/channels/${channelId}/flows/${savedId}`, body)
        : await api.post<{ id: string; validationErrors: FlowValidationError[] }>(`/api/channels/${channelId}/flows`, body);
      setSavedId(result.id);
      setMetaErrors(result.validationErrors);
      onSaved();
      if (result.validationErrors.length === 0) {
        toast.success("Flow salvo como rascunho, sem erros. Já pode ser publicado.");
        onOpenChange(false);
      } else {
        toast.warning("Flow salvo como rascunho, mas a Meta encontrou erros no JSON.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o flow.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{flow ? `Editar "${flow.name}"` : "Novo flow"}</DialogTitle>
          <DialogDescription>
            Flows são formulários interativos abertos dentro do WhatsApp, como cadastros, agendamentos e pesquisas. O flow
            é salvo como rascunho e só pode ser enviado aos contatos depois de publicado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flow-name" className="font-bold">
              Nome
            </Label>
            <Input id="flow-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="ex.: Cadastro de clientes" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="font-bold">Categorias</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.entries(FLOW_CATEGORY_LABELS).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={categories.includes(value)} onCheckedChange={(v) => toggleCategory(value, v === true)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="flow-json" className="font-bold">
                Estrutura do flow (JSON)
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setJson(prettify(json))} disabled={Boolean(jsonError)}>
                <Braces className="size-4" /> Formatar
              </Button>
            </div>
            <Textarea
              id="flow-json"
              rows={18}
              spellCheck={false}
              value={json}
              onChange={(e) => setJson(e.target.value)}
              className="font-mono text-xs"
            />
            {jsonError ? (
              <p className="text-destructive text-xs">JSON inválido: {jsonError}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Você pode montar o flow visualmente no Flow Builder do WhatsApp Manager e colar o JSON aqui.
              </p>
            )}
          </div>

          {metaErrors.length > 0 && (
            <div className="bg-destructive/10 text-destructive flex flex-col gap-1.5 rounded-md p-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-3.5" /> A Meta encontrou {metaErrors.length} erro(s) no JSON:
              </span>
              {metaErrors.map((e, i) => (
                <span key={i}>
                  {e.line_start ? `Linha ${e.line_start}, coluna ${e.column_start}: ` : ""}
                  {e.message}
                </span>
              ))}
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !name.trim() || categories.length === 0 || Boolean(jsonError)}>
            {saving ? "Salvando…" : "Salvar rascunho"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
