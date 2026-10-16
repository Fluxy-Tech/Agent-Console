import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { TemplatePreview } from "./template-preview";
import { EMPTY_FORM, LANGUAGES, LIMITS, sanitizeName, variablesOf, type TemplateButton, type TemplateForm } from "./template-utils";

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className="text-muted-foreground text-xs">
      {value.length}/{max}
    </span>
  );
}

const NEW_BUTTON: Record<TemplateButton["type"], TemplateButton> = {
  QUICK_REPLY: { type: "QUICK_REPLY", text: "" },
  URL: { type: "URL", text: "", url: "", example: "" },
  PHONE_NUMBER: { type: "PHONE_NUMBER", text: "", phoneNumber: "" },
  COPY_CODE: { type: "COPY_CODE", example: "" },
};

const BUTTON_LABELS: Record<TemplateButton["type"], string> = {
  QUICK_REPLY: "Resposta rápida",
  URL: "Abrir link",
  PHONE_NUMBER: "Ligar",
  COPY_CODE: "Copiar código",
};

/// Criar template (do zero ou a partir de um clone) e mandar para a análise
/// da Meta.
export function TemplateEditorDialog({
  channelId,
  initial,
  warnings,
  cloneOf,
  open,
  onOpenChange,
  onCreated,
}: {
  channelId: string;
  initial?: TemplateForm;
  warnings?: string[];
  /// Nome do template de origem quando é um clone.
  cloneOf?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(structuredClone(initial ?? EMPTY_FORM));
    setError(null);
  }, [open, initial]);

  const bodyVars = variablesOf(form.body.text);
  const headerHasVar = variablesOf(form.header.text).length > 0;
  const update = (patch: Partial<TemplateForm>) => setForm((f) => ({ ...f, ...patch }));

  function addVariable() {
    const next = (bodyVars.at(-1) ?? 0) + 1;
    update({ body: { ...form.body, text: `${form.body.text}{{${next}}}` } });
  }

  function setExample(index: number, value: string) {
    const examples = [...form.body.examples];
    examples[index] = value;
    update({ body: { ...form.body, examples } });
  }

  function updateButton(index: number, button: TemplateButton) {
    update({ buttons: form.buttons.map((b, i) => (i === index ? button : b)) });
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, body: { ...form.body, examples: bodyVars.map((_, i) => form.body.examples[i] ?? "") } };
      const result = await api.post<{ status: string }>(`/api/channels/${channelId}/message-templates`, body);
      toast.success(
        result.status === "APPROVED"
          ? "Template aprovado pela Meta."
          : result.status === "REJECTED"
            ? "A Meta reprovou o template. Veja o motivo na lista."
            : "Template enviado para aprovação da Meta.",
      );
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{cloneOf ? `Clonar "${cloneOf}"` : "Novo template"}</DialogTitle>
          <DialogDescription>
            {cloneOf
              ? "Uma cópia foi preparada com o conteúdo do template original. Edite o que desejar e envie para aprovação."
              : "Monte a mensagem e envie para aprovação da Meta. A análise costuma levar de alguns minutos a algumas horas."}
          </DialogDescription>
        </DialogHeader>

        {warnings && warnings.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            {warnings.map((w) => (
              <span key={w} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
              </span>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-name" className="font-bold">
                Nome
              </Label>
              <Input id="tpl-name" value={form.name} onChange={(e) => update({ name: sanitizeName(e.target.value) })} placeholder="ex.: confirmacao_pedido" />
              <p className="text-muted-foreground text-xs">Somente letras minúsculas, números e _. Não pode repetir um nome já usado.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="font-bold">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => update({ category: v as TemplateForm["category"] })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utilidade (avisos, confirmações, atualizações)</SelectItem>
                    <SelectItem value="MARKETING">Marketing (promoções, ofertas, novidades)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="font-bold">Idioma</Label>
                <Select value={form.language} onValueChange={(v) => update({ language: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...LANGUAGES, ...(LANGUAGES.some((l) => l.value === form.language) ? [] : [{ value: form.language, label: form.language }])].map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="font-bold">Cabeçalho</Label>
                <Select
                  value={form.header.format}
                  onValueChange={(v) => update({ header: { ...form.header, format: v as "NONE" | "TEXT" } })}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sem cabeçalho</SelectItem>
                    <SelectItem value="TEXT">Texto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.header.format === "TEXT" && (
                <>
                  <div className="flex flex-col gap-1">
                    <Input value={form.header.text} maxLength={LIMITS.header} onChange={(e) => update({ header: { ...form.header, text: e.target.value } })} placeholder="ex.: Pedido confirmado" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Aceita uma variável, {"{{1}}"}.</span>
                      <Counter value={form.header.text} max={LIMITS.header} />
                    </div>
                  </div>
                  {headerHasVar && (
                    <Input value={form.header.example} onChange={(e) => update({ header: { ...form.header, example: e.target.value } })} placeholder="Exemplo para {{1}} do cabeçalho" />
                  )}
                </>
              )}
            </div>

            <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="tpl-body" className="font-bold">
                  Mensagem
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addVariable}>
                  <Plus className="size-4" /> Variável
                </Button>
              </div>
              <Textarea
                id="tpl-body"
                rows={6}
                maxLength={LIMITS.body}
                value={form.body.text}
                onChange={(e) => update({ body: { ...form.body, text: e.target.value } })}
                placeholder="ex.: Olá, {{1}}! Seu pedido {{2}} foi confirmado."
              />
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  Use {"{{1}}"}, {"{{2}}"}... para trechos que mudam a cada envio, como o nome do contato. Use *texto* para negrito.
                </span>
                <Counter value={form.body.text} max={LIMITS.body} />
              </div>
              {bodyVars.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-xs">A Meta exige um exemplo para cada variável na análise:</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {bodyVars.map((v, i) => (
                      <Input key={v} value={form.body.examples[i] ?? ""} onChange={(e) => setExample(i, e.target.value)} placeholder={`Exemplo para {{${v}}}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-end justify-between">
                <Label htmlFor="tpl-footer" className="font-bold">
                  Rodapé (opcional)
                </Label>
                <Counter value={form.footer} max={LIMITS.footer} />
              </div>
              <Input id="tpl-footer" value={form.footer} maxLength={LIMITS.footer} onChange={(e) => update({ footer: e.target.value })} placeholder="ex.: Equipe Sturnus" />
            </div>

            <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="font-bold">
                  Botões ({form.buttons.length}/{LIMITS.buttons})
                </Label>
                <Select value="" onValueChange={(v) => update({ buttons: [...form.buttons, structuredClone(NEW_BUTTON[v as TemplateButton["type"]])] })} disabled={form.buttons.length >= LIMITS.buttons}>
                  <SelectTrigger className="h-8 w-44">
                    <SelectValue placeholder="Adicionar botão" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(BUTTON_LABELS) as TemplateButton["type"][]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {BUTTON_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.buttons.map((b, i) => (
                <div key={i} className="bg-muted/40 flex flex-col gap-2 rounded-md p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{BUTTON_LABELS[b.type]}</span>
                    <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => update({ buttons: form.buttons.filter((_, j) => j !== i) })} aria-label="Remover botão">
                      <Trash2 className="text-destructive size-3.5" />
                    </Button>
                  </div>
                  {b.type !== "COPY_CODE" && (
                    <Input value={b.text} maxLength={LIMITS.buttonText} onChange={(e) => updateButton(i, { ...b, text: e.target.value })} placeholder="Texto do botão" />
                  )}
                  {b.type === "URL" && (
                    <>
                      <Input value={b.url} onChange={(e) => updateButton(i, { ...b, url: e.target.value })} placeholder="https://seusite.com.br/pagina" />
                      <span className="text-muted-foreground text-xs">
                        Para um link diferente a cada envio, termine o endereço com {"{{1}}"} e informe um exemplo completo.
                      </span>
                      {variablesOf(b.url).length > 0 && (
                        <Input value={b.example} onChange={(e) => updateButton(i, { ...b, example: e.target.value })} placeholder="Exemplo: https://seusite.com.br/pagina/123" />
                      )}
                    </>
                  )}
                  {b.type === "PHONE_NUMBER" && (
                    <Input value={b.phoneNumber} onChange={(e) => updateButton(i, { ...b, phoneNumber: e.target.value.replace(/\D/g, "") })} placeholder="Telefone com DDI e DDD, ex.: 5534999999999" />
                  )}
                  {b.type === "COPY_CODE" && (
                    <Input value={b.example} maxLength={LIMITS.copyCode} onChange={(e) => updateButton(i, { ...b, example: e.target.value })} placeholder="Código de exemplo, ex.: PROMO10" />
                  )}
                </div>
              ))}
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <div className="flex flex-col gap-2 lg:sticky lg:top-0 lg:self-start">
            <Label className="font-bold">Prévia</Label>
            <TemplatePreview
              headerText={form.header.format === "TEXT" ? form.header.text : undefined}
              headerExample={form.header.example}
              bodyText={form.body.text}
              bodyExamples={form.body.examples}
              footerText={form.footer}
              buttons={form.buttons}
            />
            <p className="text-muted-foreground text-xs">As variáveis aparecem preenchidas com os exemplos.</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || !form.name || !form.body.text.trim()}>
            {saving ? "Enviando…" : "Enviar para aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
