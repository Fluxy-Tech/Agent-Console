import { api } from "@/lib/api";
import type { SupportSeverity, SupportTicketStatus } from "@/types/domain";

/// Chave SWR da lista de tickets — a mesma pras duas áreas (a API já devolve
/// o recorte certo pra quem consulta).
export const SUPPORT_TICKETS_KEY = "/api/support/tickets";

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "destructive";

export interface SeverityInfo {
  label: string;
  name: string;
  summary: string;
  impact: string;
  examples: string[];
  badge: BadgeVariant;
  /// Classes do destaque do card de escolha (borda/fundo quando selecionado).
  accentClassName: string;
}

/// Classificação do chamado — espelho do comentário de SupportSeverity no
/// schema do Agent-Api. Cresce com o impacto: S1 < S2 < S3.
export const SEVERITY_INFO: Record<SupportSeverity, SeverityInfo> = {
  S1: {
    label: "S1",
    name: "Baixa",
    summary: "Erro simples, sem impacto no funcionamento.",
    impact:
      "Problema pontual, visual ou dúvida. A plataforma segue funcionando normalmente e existe uma forma de contornar.",
    examples: [
      "Texto, rótulo ou layout incorreto",
      "Lentidão isolada em uma tela",
      "Dúvida de configuração ou de uso",
    ],
    badge: "secondary",
    accentClassName: "border-primary/60 bg-primary/5",
  },
  S2: {
    label: "S2",
    name: "Alta",
    summary: "Impacta o funcionamento e a visualização.",
    impact:
      "Uma funcionalidade ou tela não funciona, ou mostra dados errados, sem contorno simples — mas o atendimento no WhatsApp continua.",
    examples: [
      "Campanha não dispara ou Kanban não salva",
      "Relatório/métrica não carrega ou mostra valores errados",
      "Agente de IA respondendo de forma incorreta",
    ],
    badge: "warning",
    accentClassName: "border-warning/70 bg-warning/5",
  },
  S3: {
    label: "S3",
    name: "Crítica",
    summary: "Operação parada ou conexão com a Meta afetada.",
    impact:
      "Impacta visualização, funcionalidades e a conexão com a Meta: plataforma fora do ar/inacessível ou WhatsApp sem enviar/receber mensagens.",
    examples: [
      "Plataforma indisponível para toda a equipe",
      "Mensagens do WhatsApp não chegam ou não saem",
      "Número/token da Meta desconectado ou templates bloqueados",
    ],
    badge: "destructive",
    accentClassName: "border-destructive/70 bg-destructive/5",
  },
};

export const SEVERITIES: SupportSeverity[] = ["S1", "S2", "S3"];

export const STATUS_INFO: Record<SupportTicketStatus, { label: string; badge: BadgeVariant }> = {
  OPEN: { label: "Aberto", badge: "default" },
  IN_PROGRESS: { label: "Em atendimento", badge: "warning" },
  WAITING_CUSTOMER: { label: "Aguardando empresa", badge: "outline" },
  RESOLVED: { label: "Resolvido", badge: "success" },
};

export const STATUSES: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED"];

/// Espelho de SUPPORT_ATTACHMENT_CONTENT_TYPES/MAX_BYTES do Agent-Api.
export const SUPPORT_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
  ".json",
  ".zip",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
].join(",");

/// Alguns navegadores/SOs não preenchem file.type pra .csv/.json/.zip —
/// cai pela extensão pra mandar um content type aceito pela API.
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export function resolveContentType(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? file.type;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/// Retorna a mensagem de erro de um arquivo que nem deve ser enviado, ou null.
export function validateSupportFile(file: File): string | null {
  if (!CONTENT_TYPE_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""]) {
    return `${file.name}: tipo de arquivo não permitido.`;
  }
  if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) return `${file.name}: passa do limite de 25 MB.`;
  return null;
}

export interface UploadedSupportFile {
  s3Key: string;
  fileName: string;
  contentType: string;
}

/// Mesmo fluxo dos anexos do CRM: URL presignada → PUT direto no S3. A
/// confirmação (gravar no banco) acontece junto com a criação do chamado ou
/// da mensagem, que recebe as chaves devolvidas aqui. ticketId presente =
/// anexo de mensagem (a chave sai no prefixo da empresa do chamado).
export async function uploadSupportFiles(files: File[], ticketId?: string): Promise<UploadedSupportFile[]> {
  const uploaded: UploadedSupportFile[] = [];
  for (const file of files) {
    const contentType = resolveContentType(file);
    const { uploadUrl, s3Key } = await api.post<{ uploadUrl: string; s3Key: string }>("/api/support/attachments/presign", {
      fileName: file.name,
      contentType,
      size: file.size,
      ...(ticketId ? { ticketId } : {}),
    });
    const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
    if (!response.ok) throw new Error(`Falha ao enviar ${file.name}.`);
    uploaded.push({ s3Key, fileName: file.name, contentType });
  }
  return uploaded;
}
