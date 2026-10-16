import { useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AgentFeatureType } from "@/types/domain";
import { LIMITS } from "./feature-registry";

export type Config = Record<string, unknown>;

export interface EditorProps {
  agentId: string;
  config: Config;
  onChange: (config: Config) => void;
  disabled?: boolean;
}

/// Config inicial de cada tipo ao adicionar.
export const DEFAULT_CONFIGS: Partial<Record<AgentFeatureType, Config>> = {
  CATALOG: { catalogId: "", catalogName: "" },
  PRODUCT_CAROUSEL: { catalogId: "", catalogName: "", source: "agent", productIds: [] },
  CTA_URL: { url: "", displayText: "", headerText: "", footerText: "" },
  LIST: { buttonText: "Ver opções", headerText: "", footerText: "", sections: [{ title: "Opções", rows: [] }] },
  REPLY_BUTTONS: { mode: "free", buttons: [], rules: "" },
  MEDIA_CAROUSEL: { source: "manual", cards: [] },
  LOCATION_REQUEST: { bodyText: "" },
  CONTEXTUAL_REPLY: {},
  LINK_PREVIEW: { url: "" },
  FLOW: { flowId: "", flowName: "", wabaId: "", status: "", ctaText: "", bodyText: "", headerText: "", footerText: "", saveAsMetadata: true },
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

function newId(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
  return `${slug || "opcao"}_${Math.random().toString(36).slice(2, 7)}`;
}

/// Campo de texto com rótulo e contador de caracteres.
export function TextField({
  id,
  label,
  value,
  onChange,
  max,
  placeholder,
  hint,
  disabled,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  placeholder?: string;
  hint?: ReactNode;
  disabled?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor={id} className="font-bold">
          {label}
        </Label>
        {max && (
          <span className="text-muted-foreground text-xs">
            {value.length}/{max}
          </span>
        )}
      </div>
      {multiline ? (
        <Textarea
          id={id}
          rows={3}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function SourceSelect({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-bold">Origem dos itens</Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-col gap-0.5 rounded-lg border p-3 text-left text-sm transition-colors",
              value === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40",
            )}
          >
            <span className="font-semibold">{o.label}</span>
            <span className="text-muted-foreground text-xs">{o.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Catálogo ----------

interface AgentCatalogs {
  catalogs: { id: string; name: string }[];
  hasChannels: boolean;
  errors: string[];
}

function CatalogPicker({ agentId, config, onChange, disabled }: EditorProps) {
  const { data, error, isLoading } = useSWR<AgentCatalogs>(`/api/agents/${agentId}/catalogs`);
  const catalogId = str(config.catalogId);
  const catalogs = data?.catalogs ?? [];
  const options =
    catalogId && !catalogs.some((c) => c.id === catalogId)
      ? [...catalogs, { id: catalogId, name: str(config.catalogName) || catalogId }]
      : catalogs;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="feature-catalog" className="font-bold">
        Catálogo
      </Label>
      <Select
        value={catalogId}
        onValueChange={(id) =>
          onChange({ ...config, catalogId: id, catalogName: options.find((c) => c.id === id)?.name ?? "", productIds: [] })
        }
        disabled={disabled || isLoading}
      >
        <SelectTrigger id="feature-catalog" className="w-full">
          <SelectValue placeholder={isLoading ? "Consultando catálogos na Meta…" : "Selecione o catálogo"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">
        Catálogos conectados às contas do WhatsApp das redes sociais vinculadas a este agente.
      </p>
      {error && <p className="text-destructive text-xs">Não foi possível consultar os catálogos.</p>}
      {data && !data.hasChannels && (
        <p className="text-muted-foreground text-xs">Vincule o agente a uma rede social para listar os catálogos.</p>
      )}
      {data && data.hasChannels && catalogs.length === 0 && data.errors.length === 0 && (
        <p className="text-muted-foreground text-xs">
          Nenhum catálogo conectado. Conecte um catálogo à conta do WhatsApp no Commerce Manager da Meta.
        </p>
      )}
      {data && data.errors.length > 0 && (
        <div className="bg-destructive/10 text-destructive flex flex-col gap-1 rounded-md p-2 text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-3.5" /> Algumas redes sociais não retornaram catálogos:
          </span>
          {data.errors.map((m) => (
            <span key={m}>{m}</span>
          ))}
          <span>O token da Meta precisa da permissão catalog_management.</span>
        </div>
      )}
    </div>
  );
}

export function CatalogEditor(props: EditorProps) {
  return <CatalogPicker {...props} />;
}

interface CatalogProduct {
  retailerId: string;
  name: string;
  price: string | null;
  imageUrl: string | null;
}

function ProductPicker({ agentId, config, onChange, disabled }: EditorProps) {
  const catalogId = str(config.catalogId);
  const { data, error, isLoading } = useSWR<CatalogProduct[]>(
    catalogId ? `/api/agents/${agentId}/catalogs/${catalogId}/products` : null,
  );
  const selected = (config.productIds as string[] | undefined) ?? [];

  function toggle(id: string, checked: boolean) {
    const next = checked ? [...selected, id] : selected.filter((s) => s !== id);
    onChange({ ...config, productIds: next.slice(0, LIMITS.carouselMax) });
  }

  if (!catalogId) return <p className="text-muted-foreground text-xs">Selecione o catálogo para escolher os produtos.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-bold">
        Produtos do carrossel ({selected.length}/{LIMITS.carouselMax})
      </Label>
      {isLoading && <p className="text-muted-foreground text-xs">Carregando produtos…</p>}
      {error && <p className="text-destructive text-xs">Não foi possível carregar os produtos.</p>}
      <div className="border-border flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
        {data?.map((p) => {
          const checked = selected.includes(p.retailerId);
          return (
            <label key={p.retailerId} className="hover:bg-accent/40 flex cursor-pointer items-center gap-3 rounded-md p-1.5 text-sm">
              <Checkbox
                checked={checked}
                disabled={disabled || (!checked && selected.length >= LIMITS.carouselMax)}
                onCheckedChange={(v) => toggle(p.retailerId, v === true)}
              />
              {p.imageUrl && <img src={p.imageUrl} alt="" className="size-8 rounded-sm object-cover" />}
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-muted-foreground text-xs">{p.price}</span>
            </label>
          );
        })}
        {data?.length === 0 && <p className="text-muted-foreground p-1 text-xs">Catálogo sem produtos.</p>}
      </div>
      <p className="text-muted-foreground text-xs">Escolha de 2 a 10 produtos.</p>
    </div>
  );
}

export function ProductCarouselEditor(props: EditorProps) {
  const { config, onChange, disabled } = props;
  const source = str(config.source) || "agent";
  return (
    <div className="flex flex-col gap-4">
      <CatalogPicker {...props} />
      <SourceSelect
        value={source}
        disabled={disabled}
        onChange={(v) => onChange({ ...config, source: v })}
        options={[
          { value: "agent", label: "A IA escolhe", hint: "Os produtos certos para cada conversa, do catálogo." },
          { value: "manual", label: "Fixos", hint: "Você escolhe os produtos aqui." },
          { value: "integration", label: "Sistema da empresa", hint: "Vêm de uma integração com o seu sistema." },
        ]}
      />
      {source === "manual" && <ProductPicker {...props} />}
      {source === "integration" && <IntegrationHint />}
    </div>
  );
}

function IntegrationHint() {
  return (
    <p className="bg-muted/50 text-muted-foreground rounded-md p-3 text-xs">
      Os itens vêm do sistema da sua empresa por uma integração feita pela equipe Sturnus. Enquanto ela não estiver
      configurada, o agente não envia esta funcionalidade.
    </p>
  );
}

// ---------- Botão de link / Prévia de link ----------

export function CtaUrlEditor({ config, onChange, disabled }: EditorProps) {
  const set = (key: string) => (value: string) => onChange({ ...config, [key]: value });
  return (
    <div className="flex flex-col gap-4">
      <TextField id="cta-url" label="Link" value={str(config.url)} onChange={set("url")} placeholder="https://" disabled={disabled} />
      <TextField
        id="cta-text"
        label="Texto do botão"
        value={str(config.displayText)}
        onChange={set("displayText")}
        max={LIMITS.buttonText}
        placeholder="Ex.: Acessar o site"
        disabled={disabled}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="cta-header" label="Cabeçalho (opcional)" value={str(config.headerText)} onChange={set("headerText")} max={LIMITS.headerText} disabled={disabled} />
        <TextField id="cta-footer" label="Rodapé (opcional)" value={str(config.footerText)} onChange={set("footerText")} max={LIMITS.footerText} disabled={disabled} />
      </div>
      <p className="text-muted-foreground text-xs">O texto da mensagem é escrito pelo agente na conversa.</p>
    </div>
  );
}

export function LinkPreviewEditor({ config, onChange, disabled }: EditorProps) {
  return (
    <TextField
      id="preview-url"
      label="Link"
      value={str(config.url)}
      onChange={(url) => onChange({ ...config, url })}
      placeholder="https://"
      hint="O WhatsApp mostra o título e a imagem do site junto com o link."
      disabled={disabled}
    />
  );
}

// ---------- Lista ----------

interface ListRow {
  id: string;
  title: string;
  description: string;
}
interface ListSection {
  title: string;
  rows: ListRow[];
}

export function ListEditor({ config, onChange, disabled }: EditorProps) {
  const sections = (config.sections as ListSection[] | undefined) ?? [];
  const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
  const set = (key: string) => (value: string) => onChange({ ...config, [key]: value });
  const setSections = (next: ListSection[]) => onChange({ ...config, sections: next });

  function updateSection(index: number, patch: Partial<ListSection>) {
    setSections(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function updateRow(si: number, ri: number, patch: Partial<ListRow>) {
    updateSection(si, { rows: sections[si].rows.map((r, i) => (i === ri ? { ...r, ...patch } : r)) });
  }

  return (
    <div className="flex flex-col gap-4">
      <TextField id="list-button" label="Texto do botão que abre a lista" value={str(config.buttonText)} onChange={set("buttonText")} max={LIMITS.buttonText} disabled={disabled} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="list-header" label="Cabeçalho (opcional)" value={str(config.headerText)} onChange={set("headerText")} max={LIMITS.headerText} disabled={disabled} />
        <TextField id="list-footer" label="Rodapé (opcional)" value={str(config.footerText)} onChange={set("footerText")} max={LIMITS.footerText} disabled={disabled} />
      </div>

      <div className="flex items-center justify-between">
        <Label className="font-bold">
          Opções ({totalRows}/{LIMITS.listRows})
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || sections.length >= 10}
          onClick={() => setSections([...sections, { title: "", rows: [] }])}
        >
          <Plus className="size-4" /> Seção
        </Button>
      </div>

      {sections.map((section, si) => (
        <div key={si} className="border-border flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextField id={`list-section-${si}`} label={`Título da seção ${si + 1}`} value={section.title} onChange={(title) => updateSection(si, { title })} max={LIMITS.sectionTitle} disabled={disabled} />
            </div>
            <Button type="button" variant="ghost" size="icon" disabled={disabled || sections.length === 1} onClick={() => setSections(sections.filter((_, i) => i !== si))} aria-label="Remover seção">
              <Trash2 className="text-destructive size-4" />
            </Button>
          </div>
          {section.rows.map((row, ri) => (
            <div key={row.id} className="bg-muted/40 grid gap-2 rounded-md p-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
              <TextField id={`row-${row.id}-title`} label="Opção" value={row.title} onChange={(title) => updateRow(si, ri, { title })} max={LIMITS.rowTitle} disabled={disabled} />
              <TextField id={`row-${row.id}-desc`} label="Descrição (opcional)" value={row.description} onChange={(description) => updateRow(si, ri, { description })} max={LIMITS.rowDescription} disabled={disabled} />
              <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={() => updateSection(si, { rows: section.rows.filter((_, i) => i !== ri) })} aria-label="Remover opção">
                <Trash2 className="text-destructive size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            disabled={disabled || totalRows >= LIMITS.listRows}
            onClick={() => updateSection(si, { rows: [...section.rows, { id: newId(""), title: "", description: "" }] })}
          >
            <Plus className="size-4" /> Opção
          </Button>
        </div>
      ))}
    </div>
  );
}

// ---------- Botões de resposta ----------

export function ReplyButtonsEditor({ config, onChange, disabled }: EditorProps) {
  const mode = str(config.mode) || "free";
  const buttons = (config.buttons as string[] | undefined) ?? [];
  const setButton = (index: number, value: string) => {
    const next = [...buttons];
    next[index] = value;
    onChange({ ...config, buttons: next });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="font-bold">Quem define os botões</Label>
        <Select value={mode} onValueChange={(v) => onChange({ ...config, mode: v })} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">A IA cria os botões conforme a conversa</SelectItem>
            <SelectItem value="fixed">Botões fixos definidos aqui</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === "fixed" && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <TextField
              key={i}
              id={`reply-button-${i}`}
              label={`Botão ${i + 1}${i === 0 ? "" : " (opcional)"}`}
              value={buttons[i] ?? ""}
              onChange={(v) => setButton(i, v)}
              max={LIMITS.buttonText}
              disabled={disabled}
            />
          ))}
        </div>
      )}
      <TextField
        id="reply-rules"
        label="O que a IA pode ou não pode usar nos botões"
        value={str(config.rules)}
        onChange={(rules) => onChange({ ...config, rules })}
        max={LIMITS.prompt}
        multiline
        placeholder="Ex.: Use botões só para respostas curtas como Sim/Não. Nunca ofereça desconto em um botão."
        disabled={disabled}
      />
    </div>
  );
}

/// Antes de salvar: tira botões vazios.
export function cleanReplyButtons(config: Config): Config {
  return { ...config, buttons: ((config.buttons as string[] | undefined) ?? []).map((b) => b.trim()).filter(Boolean) };
}

// ---------- Carrossel de mídia ----------

interface MediaCard {
  mediaType: "image" | "video";
  mediaKey?: string;
  mediaUrl?: string;
  previewUrl?: string;
  bodyText: string;
  buttonText: string;
  url: string;
}

const MEDIA_ACCEPT = "image/jpeg,image/png,video/mp4";
const MEDIA_MAX_BYTES = { image: 5 * 1024 * 1024, video: 16 * 1024 * 1024 };

function CardMedia({ agentId, card, onChange, disabled }: { agentId: string; card: MediaCard; onChange: (card: MediaCard) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const preview = card.previewUrl ?? card.mediaUrl;

  async function handleFile(file: File) {
    const mediaType = file.type === "video/mp4" ? "video" : "image";
    if (!MEDIA_ACCEPT.split(",").includes(file.type)) return toast.error("Use imagem JPG/PNG ou vídeo MP4.");
    if (file.size > MEDIA_MAX_BYTES[mediaType]) return toast.error(mediaType === "video" ? "O vídeo pode ter até 16 MB." : "A imagem pode ter até 5 MB.");
    setUploading(true);
    try {
      const { uploadUrl, s3Key, previewUrl } = await api.post<{ uploadUrl: string; s3Key: string; previewUrl: string }>(
        `/api/agents/${agentId}/features/media/presign`,
        { fileName: file.name, contentType: file.type },
      );
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("upload");
      onChange({ ...card, mediaType, mediaKey: s3Key, mediaUrl: undefined, previewUrl });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="bg-muted flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {preview ? (
          card.mediaType === "video" ? (
            <video src={preview} className="size-full object-cover" muted />
          ) : (
            <img src={preview} alt="" className="size-full object-cover" />
          )
        ) : (
          <ImagePlus className="text-muted-foreground size-6" />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Button loading={uploading} type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? "Enviando…" : preview ? "Trocar mídia" : "Enviar imagem ou vídeo"}
        </Button>
        <span className="text-muted-foreground text-xs">JPG/PNG até 5 MB ou MP4 até 16 MB.</span>
        <input
          ref={inputRef}
          type="file"
          accept={MEDIA_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export function MediaCarouselEditor({ agentId, config, onChange, disabled }: EditorProps) {
  const source = str(config.source) || "manual";
  const cards = (config.cards as MediaCard[] | undefined) ?? [];
  const setCards = (next: MediaCard[]) => onChange({ ...config, cards: next });
  const updateCard = (index: number, card: MediaCard) => setCards(cards.map((c, i) => (i === index ? card : c)));

  return (
    <div className="flex flex-col gap-4">
      <SourceSelect
        value={source}
        disabled={disabled}
        onChange={(v) => onChange({ ...config, source: v })}
        options={[
          { value: "manual", label: "Cards fixos", hint: "Você monta os cards aqui, com as mídias." },
          { value: "integration", label: "Sistema da empresa", hint: "Os cards vêm de uma integração com o seu sistema." },
        ]}
      />
      {source === "integration" ? (
        <IntegrationHint />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Label className="font-bold">
              Cards ({cards.length}/{LIMITS.carouselMax})
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || cards.length >= LIMITS.carouselMax}
              onClick={() => setCards([...cards, { mediaType: "image", bodyText: "", buttonText: "", url: "" }])}
            >
              <Plus className="size-4" /> Card
            </Button>
          </div>
          {cards.map((card, i) => (
            <div key={i} className="border-border flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <CardMedia agentId={agentId} card={card} onChange={(c) => updateCard(i, c)} disabled={disabled} />
                <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={() => setCards(cards.filter((_, j) => j !== i))} aria-label="Remover card">
                  <Trash2 className="text-destructive size-4" />
                </Button>
              </div>
              <TextField id={`card-${i}-body`} label="Texto do card (opcional)" value={card.bodyText} onChange={(bodyText) => updateCard(i, { ...card, bodyText })} max={LIMITS.cardBody} disabled={disabled} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id={`card-${i}-button`} label="Texto do botão" value={card.buttonText} onChange={(buttonText) => updateCard(i, { ...card, buttonText })} max={LIMITS.buttonText} disabled={disabled} />
                <TextField id={`card-${i}-url`} label="Link do botão" value={card.url} onChange={(url) => updateCard(i, { ...card, url })} placeholder="https://" disabled={disabled} />
              </div>
            </div>
          ))}
          {cards.length < LIMITS.carouselMin && (
            <p className="text-muted-foreground text-xs">O carrossel precisa de 2 a 10 cards.</p>
          )}
        </>
      )}
    </div>
  );
}

/// Antes de salvar: a prévia assinada é só de exibição.
export function cleanMediaCarousel(config: Config): Config {
  const cards = ((config.cards as MediaCard[] | undefined) ?? []).map((card) => {
    const rest = { ...card };
    delete rest.previewUrl;
    return rest;
  });
  return { ...config, cards };
}

// ---------- Localização / Respostas contextuais ----------

export function LocationEditor({ config, onChange, disabled }: EditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <TextField
        id="location-body"
        label="Texto padrão do pedido (opcional)"
        value={str(config.bodyText)}
        onChange={(bodyText) => onChange({ ...config, bodyText })}
        max={1024}
        multiline
        placeholder="Ex.: Pode me enviar sua localização para eu calcular a entrega?"
        hint="Usado quando o agente não escrever o próprio texto."
        disabled={disabled}
      />
      <p className="bg-muted/50 text-muted-foreground rounded-md p-3 text-xs">
        Quando o contato enviar a localização, ela fica salva automaticamente no metadado <strong>localization</strong>{" "}
        do contato.
      </p>
    </div>
  );
}

export function ContextualReplyEditor() {
  return (
    <p className="bg-muted/50 text-muted-foreground rounded-md p-3 text-xs">
      O agente passa a receber a referência de cada mensagem do contato e, quando estiver respondendo a uma mensagem
      específica (por exemplo, quando o contato mandou várias perguntas seguidas), a resposta sai citando essa
      mensagem.
    </p>
  );
}

// ---------- Formulário (Flow) ----------

interface AgentFlows {
  flows: { id: string; name: string; status: string; wabaId: string; channel: string }[];
  hasChannels: boolean;
  errors: string[];
}

const FLOW_STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicado" };

export function FlowEditor({ agentId, config, onChange, disabled }: EditorProps) {
  const { data, error, isLoading } = useSWR<AgentFlows>(`/api/agents/${agentId}/flows`);
  const flowId = str(config.flowId);
  const flows = data?.flows ?? [];
  const selected = flows.find((f) => f.id === flowId);
  const options =
    flowId && !selected
      ? [...flows, { id: flowId, name: str(config.flowName) || flowId, status: str(config.status), wabaId: str(config.wabaId), channel: "" }]
      : flows;
  const status = selected?.status ?? str(config.status);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feature-flow" className="font-bold">
          Flow
        </Label>
        <Select
          value={flowId}
          onValueChange={(id) => {
            const flow = options.find((f) => f.id === id);
            onChange({ ...config, flowId: id, flowName: flow?.name ?? "", wabaId: flow?.wabaId ?? "", status: flow?.status ?? "" });
          }}
          disabled={disabled || isLoading}
        >
          <SelectTrigger id="feature-flow" className="w-full">
            <SelectValue placeholder={isLoading ? "Consultando flows na Meta…" : "Selecione o flow"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name} · {FLOW_STATUS_LABEL[f.status] ?? f.status}
                {f.channel ? ` · ${f.channel}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Flows em rascunho ou publicados das redes sociais vinculadas a este agente. Crie e publique flows em Redes
          sociais, na aba Flows.
        </p>
        {status === "DRAFT" && (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Este flow está em rascunho e é enviado em modo de teste.
            Publique o flow para usar com os contatos.
          </p>
        )}
        {error && <p className="text-destructive text-xs">Não foi possível consultar os flows.</p>}
        {data && !data.hasChannels && <p className="text-muted-foreground text-xs">Vincule o agente a uma rede social para listar os flows.</p>}
        {data && data.hasChannels && flows.length === 0 && data.errors.length === 0 && (
          <p className="text-muted-foreground text-xs">Nenhum flow em rascunho ou publicado nas redes sociais deste agente.</p>
        )}
        {data && data.errors.length > 0 && (
          <div className="bg-destructive/10 text-destructive flex flex-col gap-1 rounded-md p-2 text-xs">
            {data.errors.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        )}
      </div>

      <TextField
        id="flow-cta"
        label="Texto do botão"
        value={str(config.ctaText)}
        onChange={(ctaText) => onChange({ ...config, ctaText })}
        max={LIMITS.flowCta}
        placeholder="Ex.: Preencher cadastro"
        disabled={disabled}
      />
      <TextField
        id="flow-body"
        label="Texto padrão da mensagem (opcional)"
        value={str(config.bodyText)}
        onChange={(bodyText) => onChange({ ...config, bodyText })}
        max={1024}
        multiline
        placeholder="Ex.: Para agilizar, preencha seus dados pelo botão abaixo."
        hint="Usado quando o agente não escrever o próprio texto."
        disabled={disabled}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="flow-header"
          label="Cabeçalho (opcional)"
          value={str(config.headerText)}
          onChange={(headerText) => onChange({ ...config, headerText })}
          max={LIMITS.headerText}
          disabled={disabled}
        />
        <TextField
          id="flow-footer"
          label="Rodapé (opcional)"
          value={str(config.footerText)}
          onChange={(footerText) => onChange({ ...config, footerText })}
          max={LIMITS.footerText}
          disabled={disabled}
        />
      </div>

      <label className="border-border flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">Salvar respostas como metadados</span>
          <span className="text-muted-foreground text-xs">
            Ligado: cada campo preenchido no flow fica salvo nos metadados do contato, com o nome do campo (ex.: nome,
            email). Desligado: o agente recebe as respostas na conversa, sem salvar.
          </span>
        </span>
        <Switch
          checked={config.saveAsMetadata === true}
          onCheckedChange={(saveAsMetadata) => onChange({ ...config, saveAsMetadata })}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
