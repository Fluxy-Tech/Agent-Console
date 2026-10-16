import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { TemplatePreview } from "./template-preview";
import {
  authenticationPreview,
  EMPTY_FORM,
  HEADER_LABELS,
  LANGUAGES,
  LIMITS,
  MEDIA_RULES,
  OTP_LABELS,
  sanitizeName,
  variablesOf,
  type AuthenticationOptions,
  type HeaderFormat,
  type MediaFormat,
  type TemplateButton,
  type TemplateForm,
} from "./template-utils";

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

  const isAuth = form.category === "AUTHENTICATION";
  const isMediaHeader = form.header.format !== "NONE" && form.header.format !== "TEXT";
  const bodyVars = variablesOf(form.body.text);
  const headerHasVar = variablesOf(form.header.text).length > 0;
  const authPreview = authenticationPreview(form.authentication);
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

  /// Trocar o tipo do cabeçalho descarta o arquivo do tipo anterior.
  function setHeaderFormat(format: HeaderFormat) {
    if (format === form.header.format) return;
    update({ header: { format, text: form.header.text, example: form.header.example } });
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const body = isAuth
        ? { name: form.name, category: form.category, language: form.language, authentication: form.authentication }
        : { ...form, body: { ...form.body, examples: bodyVars.map((_, i) => form.body.examples[i] ?? "") } };
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

  const canSubmit =
    !saving &&
    Boolean(form.name) &&
    (isAuth || (Boolean(form.body.text.trim()) && (!isMediaHeader || Boolean(form.header.mediaKey || form.header.sourceUrl))));

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
                    <SelectItem value="AUTHENTICATION">Autenticação (códigos de verificação)</SelectItem>
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

            {isAuth ? (
              <AuthenticationFields value={form.authentication} onChange={(authentication) => update({ authentication })} />
            ) : (
              <>
                <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="font-bold">Cabeçalho</Label>
                    <Select value={form.header.format} onValueChange={(v) => setHeaderFormat(v as HeaderFormat)}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(HEADER_LABELS) as HeaderFormat[]).map((f) => (
                          <SelectItem key={f} value={f}>
                            {HEADER_LABELS[f]}
                          </SelectItem>
                        ))}
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
                  {isMediaHeader && (
                    <HeaderMediaUpload
                      channelId={channelId}
                      format={form.header.format as MediaFormat}
                      header={form.header}
                      onChange={(media) => update({ header: { format: form.header.format, text: "", example: "", ...media } })}
                    />
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
              </>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <div className="flex flex-col gap-2 lg:sticky lg:top-0 lg:self-start">
            <Label className="font-bold">Prévia</Label>
            {isAuth ? (
              <TemplatePreview
                bodyText={authPreview.body}
                footerText={authPreview.footer}
                buttons={[{ type: "COPY_CODE", example: "" }]}
                copyCodeLabel={form.authentication.buttonText || "Copiar código"}
              />
            ) : (
              <TemplatePreview
                headerText={form.header.format === "TEXT" ? form.header.text : undefined}
                headerExample={form.header.example}
                mediaHeader={isMediaHeader ? { format: form.header.format as MediaFormat, url: form.header.previewUrl, fileName: form.header.fileName } : undefined}
                bodyText={form.body.text}
                bodyExamples={form.body.examples}
                footerText={form.footer}
                buttons={form.buttons}
              />
            )}
            <p className="text-muted-foreground text-xs">
              {isAuth
                ? "O texto dos templates de autenticação é definido pela Meta no idioma escolhido. O código real entra no lugar de 123456."
                : "As variáveis aparecem preenchidas com os exemplos."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={saving} type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? "Enviando…" : "Enviar para aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/// Arquivo de exemplo do cabeçalho: vai do navegador direto pro S3; no envio
/// o Agent-Api repassa pra Meta.
function HeaderMediaUpload({
  channelId,
  format,
  header,
  onChange,
}: {
  channelId: string;
  format: MediaFormat;
  header: TemplateForm["header"];
  onChange: (media: Pick<TemplateForm["header"], "mediaKey" | "previewUrl" | "fileName">) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const rule = MEDIA_RULES[format];
  const hasFile = Boolean(header.mediaKey || header.sourceUrl);

  async function handleFile(file: File) {
    if (!rule.accept.split(",").includes(file.type) || file.size > rule.maxBytes) {
      toast.error(`Arquivo não aceito. ${rule.label}`);
      return;
    }
    setUploading(true);
    try {
      const { uploadUrl, s3Key, previewUrl } = await api.post<{ uploadUrl: string; s3Key: string; previewUrl: string }>(
        `/api/channels/${channelId}/message-templates/media/presign`,
        { format, fileName: file.name, contentType: file.type, size: file.size },
      );
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("upload");
      onChange({ mediaKey: s3Key, previewUrl, fileName: file.name });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={rule.accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button loading={uploading} type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" /> {uploading ? "Enviando…" : hasFile ? "Trocar arquivo" : "Enviar arquivo de exemplo"}
        </Button>
        {header.fileName ? (
          <span className="text-muted-foreground max-w-60 truncate text-xs">{header.fileName}</span>
        ) : header.sourceUrl ? (
          <span className="text-muted-foreground text-xs">Usando a mídia do template original.</span>
        ) : null}
      </div>
      <span className="text-muted-foreground text-xs">
        {rule.label} O arquivo serve de exemplo para a análise da Meta. Em cada envio você escolhe a mídia real.
      </span>
    </div>
  );
}

/// Opções do template de autenticação: o texto é fixo da Meta.
function AuthenticationFields({ value, onChange }: { value: AuthenticationOptions; onChange: (value: AuthenticationOptions) => void }) {
  const set = (patch: Partial<AuthenticationOptions>) => onChange({ ...value, ...patch });
  const needsApp = value.otpType !== "COPY_CODE";

  return (
    <div className="border-border flex flex-col gap-4 rounded-lg border p-3">
      <div>
        <Label className="font-bold">Código de verificação</Label>
        <p className="text-muted-foreground mt-1 text-xs">
          A Meta define o texto da mensagem, por exemplo: "*123456* é seu código de verificação." Você escolhe o aviso de
          segurança, a validade e o botão.
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={value.addSecurityRecommendation} onCheckedChange={(v) => set({ addSecurityRecommendation: v === true })} />
        Incluir o aviso para não compartilhar o código
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={value.codeExpirationMinutes !== null} onCheckedChange={(v) => set({ codeExpirationMinutes: v === true ? 10 : null })} />
          Mostrar a validade do código no rodapé
        </label>
        {value.codeExpirationMinutes !== null && (
          <div className="flex items-center gap-2 pl-6">
            <Input
              type="number"
              min={1}
              max={90}
              className="w-24"
              value={value.codeExpirationMinutes}
              onChange={(e) => set({ codeExpirationMinutes: Math.min(90, Math.max(1, Number(e.target.value) || 1)) })}
            />
            <span className="text-muted-foreground text-sm">minutos (de 1 a 90)</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="font-bold">Botão</Label>
          <Select value={value.otpType} onValueChange={(v) => set({ otpType: v as AuthenticationOptions["otpType"] })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(OTP_LABELS) as AuthenticationOptions["otpType"][]).map((t) => (
                <SelectItem key={t} value={t}>
                  {OTP_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="font-bold">Texto do botão</Label>
          <Input value={value.buttonText} maxLength={LIMITS.buttonText} onChange={(e) => set({ buttonText: e.target.value })} placeholder="Copiar código" />
        </div>
      </div>

      {needsApp && (
        <div className="bg-muted/40 flex flex-col gap-3 rounded-md p-3">
          <p className="text-muted-foreground text-xs">
            Esse botão preenche o código direto no seu app Android. Se o contato não tiver o app, ele vira um botão de copiar
            código.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={value.packageName} onChange={(e) => set({ packageName: e.target.value.trim() })} placeholder="Pacote do app, ex.: com.empresa.app" />
            <Input value={value.signatureHash} maxLength={11} onChange={(e) => set({ signatureHash: e.target.value.trim() })} placeholder="Hash de assinatura (11 caracteres)" />
          </div>
          <Input value={value.autofillText} maxLength={LIMITS.buttonText} onChange={(e) => set({ autofillText: e.target.value })} placeholder="Texto do botão de preencher (opcional), ex.: Preencher" />
          {value.otpType === "ZERO_TAP" && (
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <Checkbox checked={value.zeroTapTermsAccepted} onCheckedChange={(v) => set({ zeroTapTermsAccepted: v === true })} className="mt-0.5" />
              Li e aceito os termos da Meta para o preenchimento automático, que entrega o código ao app sem o contato tocar em nada.
            </label>
          )}
        </div>
      )}
    </div>
  );
}
