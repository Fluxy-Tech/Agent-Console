/// Template de mensagem como vem da Meta (GET /api/channels/:id/message-templates).
export interface MessageTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: MetaComponent[];
  rejectedReason: string | null;
  quality: string | null;
}

export interface MetaComponent {
  type: string;
  format?: string;
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: { type: string; text?: string; url?: string; phone_number?: string; example?: string[] | string }[];
}

export type TemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example: string }
  | { type: "PHONE_NUMBER"; text: string; phoneNumber: string }
  | { type: "COPY_CODE"; example: string };

/// Formulário do editor — mesmo formato aceito pelo POST do Agent-Api.
export interface TemplateForm {
  name: string;
  category: "MARKETING" | "UTILITY";
  language: string;
  header: { format: "NONE" | "TEXT"; text: string; example: string };
  body: { text: string; examples: string[] };
  footer: string;
  buttons: TemplateButton[];
}

export const LIMITS = { header: 60, body: 1024, footer: 60, buttonText: 25, buttons: 10, copyCode: 15 } as const;

export const LANGUAGES = [
  { value: "pt_BR", label: "Português (Brasil)" },
  { value: "en_US", label: "Inglês (EUA)" },
  { value: "es", label: "Espanhol" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

export const STATUS_INFO: Record<string, { label: string; className: string }> = {
  APPROVED: { label: "Aprovado", className: "bg-success/15 text-success" },
  PENDING: { label: "Em análise", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  REJECTED: { label: "Reprovado", className: "bg-destructive/15 text-destructive" },
  PAUSED: { label: "Pausado", className: "bg-muted text-muted-foreground" },
  DISABLED: { label: "Desativado", className: "bg-muted text-muted-foreground" },
  IN_APPEAL: { label: "Em recurso", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  PENDING_DELETION: { label: "Excluindo", className: "bg-muted text-muted-foreground" },
};

export const REJECTION_LABELS: Record<string, string> = {
  INVALID_FORMAT: "Formato inválido.",
  ABUSIVE_CONTENT: "Conteúdo considerado abusivo pela Meta.",
  TAG_CONTENT_MISMATCH: "O conteúdo não corresponde à categoria escolhida.",
  PROMOTIONAL: "Conteúdo promocional em categoria que não permite.",
  SCAM: "Conteúdo considerado suspeito pela Meta.",
  INCORRECT_CATEGORY: "Categoria incorreta para este conteúdo.",
};

export const EMPTY_FORM: TemplateForm = {
  name: "",
  category: "UTILITY",
  language: "pt_BR",
  header: { format: "NONE", text: "", example: "" },
  body: { text: "", examples: [] },
  footer: "",
  buttons: [],
};

/// Variáveis {{n}} distintas do texto, em ordem.
export function variablesOf(text: string): number[] {
  return [...new Set([...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

/// Nome aceito pela Meta: minúsculas, números e "_".
export function sanitizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .slice(0, 512);
}

/// Clone: converte o template da Meta no formulário do editor. O que o editor
/// ainda não suporta (cabeçalho de mídia, botões de flow/OTP) fica de fora e
/// vira aviso pro usuário.
export function fromMetaTemplate(template: MessageTemplate, existingNames: string[]): { form: TemplateForm; warnings: string[] } {
  const warnings: string[] = [];
  const header = template.components.find((c) => c.type === "HEADER");
  const body = template.components.find((c) => c.type === "BODY");
  const footer = template.components.find((c) => c.type === "FOOTER");
  const buttons = template.components.find((c) => c.type === "BUTTONS")?.buttons ?? [];

  if (header && header.format !== "TEXT") {
    warnings.push("O cabeçalho com imagem, vídeo ou documento não foi copiado. Esta tela cria cabeçalhos de texto.");
  }

  const formButtons: TemplateButton[] = [];
  for (const b of buttons) {
    const example = Array.isArray(b.example) ? b.example[0] : b.example;
    if (b.type === "QUICK_REPLY") formButtons.push({ type: "QUICK_REPLY", text: b.text ?? "" });
    else if (b.type === "URL") formButtons.push({ type: "URL", text: b.text ?? "", url: b.url ?? "", example: example ?? "" });
    else if (b.type === "PHONE_NUMBER") formButtons.push({ type: "PHONE_NUMBER", text: b.text ?? "", phoneNumber: (b.phone_number ?? "").replace(/\D/g, "") });
    else if (b.type === "COPY_CODE") formButtons.push({ type: "COPY_CODE", example: example ?? "" });
    else warnings.push(`O botão "${b.text ?? b.type}" é de um tipo que esta tela ainda não cria e não foi copiado.`);
  }

  const bodyText = body?.text ?? "";
  const vars = variablesOf(bodyText);
  const examples = body?.example?.body_text?.[0] ?? [];

  let name = sanitizeName(`${template.name}_copia`);
  for (let i = 2; existingNames.includes(name); i++) name = sanitizeName(`${template.name}_copia_${i}`);

  return {
    form: {
      name,
      category: template.category === "MARKETING" ? "MARKETING" : "UTILITY",
      language: template.language,
      header:
        header?.format === "TEXT"
          ? { format: "TEXT", text: header.text ?? "", example: header.example?.header_text?.[0] ?? "" }
          : { format: "NONE", text: "", example: "" },
      body: { text: bodyText, examples: vars.map((_, i) => examples[i] ?? "") },
      footer: footer?.text ?? "",
      buttons: formButtons,
    },
    warnings,
  };
}

/// Texto com as variáveis trocadas pelos exemplos (pra prévia).
export function fillExamples(text: string, examples: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n) => examples[Number(n) - 1] || match);
}
