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
  example?: { header_text?: string[]; body_text?: string[][]; header_handle?: string[] };
  add_security_recommendation?: boolean;
  code_expiration_minutes?: number;
  buttons?: { type: string; text?: string; url?: string; phone_number?: string; example?: string[] | string }[];
}

export type TemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example: string }
  | { type: "PHONE_NUMBER"; text: string; phoneNumber: string }
  | { type: "COPY_CODE"; example: string };

export type HeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
export type MediaFormat = Exclude<HeaderFormat, "NONE" | "TEXT">;

export interface AuthenticationOptions {
  addSecurityRecommendation: boolean;
  codeExpirationMinutes: number | null;
  otpType: "COPY_CODE" | "ONE_TAP" | "ZERO_TAP";
  buttonText: string;
  autofillText: string;
  packageName: string;
  signatureHash: string;
  zeroTapTermsAccepted: boolean;
}

/// Formulário do editor. O POST do Agent-Api usa `authentication` só na
/// categoria AUTHENTICATION e ignora o resto.
export interface TemplateForm {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  header: {
    format: HeaderFormat;
    text: string;
    example: string;
    /// Arquivo enviado pelo Console (chave no S3).
    mediaKey?: string;
    /// Mídia de exemplo do template clonado (link da Meta).
    sourceUrl?: string;
    /// Só pra prévia.
    previewUrl?: string;
    fileName?: string;
  };
  body: { text: string; examples: string[] };
  footer: string;
  buttons: TemplateButton[];
  authentication: AuthenticationOptions;
}

/// Arquivos aceitos como mídia de exemplo do cabeçalho.
export const MEDIA_RULES: Record<MediaFormat, { accept: string; maxBytes: number; label: string }> = {
  IMAGE: { accept: "image/jpeg,image/png", maxBytes: 5 * 1024 * 1024, label: "Imagem JPG ou PNG de até 5 MB." },
  VIDEO: { accept: "video/mp4", maxBytes: 16 * 1024 * 1024, label: "Vídeo MP4 de até 16 MB." },
  DOCUMENT: { accept: "application/pdf", maxBytes: 20 * 1024 * 1024, label: "PDF de até 20 MB." },
};

export const HEADER_LABELS: Record<HeaderFormat, string> = {
  NONE: "Sem cabeçalho",
  TEXT: "Texto",
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  DOCUMENT: "Documento",
};

export const OTP_LABELS: Record<AuthenticationOptions["otpType"], string> = {
  COPY_CODE: "Copiar código",
  ONE_TAP: "Preencher com um toque (Android)",
  ZERO_TAP: "Preenchimento automático (Android)",
};

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
  authentication: {
    addSecurityRecommendation: true,
    codeExpirationMinutes: 10,
    otpType: "COPY_CODE",
    buttonText: "Copiar código",
    autofillText: "",
    packageName: "",
    signatureHash: "",
    zeroTapTermsAccepted: false,
  },
};

/// Texto fixo da Meta pros templates de autenticação (aproximado, pra prévia).
export function authenticationPreview(options: AuthenticationOptions) {
  return {
    body: `*123456* é seu código de verificação.${options.addSecurityRecommendation ? " Para sua segurança, não o compartilhe." : ""}`,
    footer: options.codeExpirationMinutes ? `Este código expira em ${options.codeExpirationMinutes} minutos.` : "",
  };
}

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
/// ainda não suporta (botões de flow, por exemplo) fica de fora e vira aviso
/// pro usuário.
export function fromMetaTemplate(template: MessageTemplate, existingNames: string[]): { form: TemplateForm; warnings: string[] } {
  const warnings: string[] = [];
  const header = template.components.find((c) => c.type === "HEADER");
  const body = template.components.find((c) => c.type === "BODY");
  const footer = template.components.find((c) => c.type === "FOOTER");
  const buttons = template.components.find((c) => c.type === "BUTTONS")?.buttons ?? [];

  let name = sanitizeName(`${template.name}_copia`);
  for (let i = 2; existingNames.includes(name); i++) name = sanitizeName(`${template.name}_copia_${i}`);

  if (template.category === "AUTHENTICATION") {
    const otp = buttons[0];
    return {
      form: {
        ...structuredClone(EMPTY_FORM),
        name,
        category: "AUTHENTICATION",
        language: template.language,
        authentication: {
          ...EMPTY_FORM.authentication,
          addSecurityRecommendation: Boolean(body?.add_security_recommendation),
          codeExpirationMinutes: footer?.code_expiration_minutes ?? null,
          buttonText: otp?.text ?? EMPTY_FORM.authentication.buttonText,
        },
      },
      warnings: ["O botão foi copiado como Copiar código. Se o original preenche o código no app, ajuste o tipo do botão."],
    };
  }

  let formHeader: TemplateForm["header"] = { format: "NONE", text: "", example: "" };
  if (header?.format === "TEXT") {
    formHeader = { format: "TEXT", text: header.text ?? "", example: header.example?.header_text?.[0] ?? "" };
  } else if (header && ["IMAGE", "VIDEO", "DOCUMENT"].includes(header.format ?? "")) {
    const sample = header.example?.header_handle?.[0];
    formHeader = { format: header.format as MediaFormat, text: "", example: "", sourceUrl: sample, previewUrl: sample };
    if (!sample) warnings.push("A mídia de exemplo do cabeçalho não veio da Meta. Envie o arquivo de novo antes de enviar.");
  } else if (header) {
    warnings.push("O cabeçalho deste template é de um tipo que esta tela ainda não cria e não foi copiado.");
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

  return {
    form: {
      ...structuredClone(EMPTY_FORM),
      name,
      category: template.category === "MARKETING" ? "MARKETING" : "UTILITY",
      language: template.language,
      header: formHeader,
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
