import { Copy, ExternalLink, FileText, ImageIcon, Phone, Reply, Video } from "lucide-react";
import fundoWhatsApp from "@/assets/FundoWhatsApp.jpg";
import { fillExamples, HEADER_LABELS, type MediaFormat, type TemplateButton } from "./template-utils";

const MEDIA_ICON = { IMAGE: ImageIcon, VIDEO: Video, DOCUMENT: FileText } as const;

const BUTTON_ICON = { QUICK_REPLY: Reply, URL: ExternalLink, PHONE_NUMBER: Phone, COPY_CODE: Copy } as const;

/// Prévia do template no estilo da conversa do WhatsApp.
export function TemplatePreview({
  headerText,
  bodyText,
  footerText,
  buttons,
  headerExample,
  bodyExamples,
  mediaHeader,
  copyCodeLabel,
}: {
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons: TemplateButton[];
  headerExample?: string;
  bodyExamples?: string[];
  /// Cabeçalho de mídia; sem `url` mostra só o tipo.
  mediaHeader?: { format: MediaFormat; url?: string; fileName?: string };
  /// Texto do botão de copiar código (autenticação).
  copyCodeLabel?: string;
}) {
  return (
    <div
      className="flex min-h-40 flex-col justify-start rounded-lg bg-cover bg-center p-3"
      style={{ backgroundImage: `url(${fundoWhatsApp})` }}
    >
      <div className="flex max-w-[92%] flex-col overflow-hidden rounded-lg bg-white text-[13px] text-neutral-900 shadow-sm">
        <div className="flex flex-col gap-1 p-2">
          {mediaHeader && <MediaHeader {...mediaHeader} />}
          {headerText && <p className="font-semibold">{fillExamples(headerText, headerExample ? [headerExample] : [])}</p>}
          <p className="break-words whitespace-pre-wrap">{bodyText ? fillExamples(bodyText, bodyExamples ?? []) : "Texto da mensagem"}</p>
          {footerText && <p className="text-[11px] text-neutral-500">{footerText}</p>}
        </div>
        {buttons.map((b, i) => {
          const Icon = BUTTON_ICON[b.type];
          const label = b.type === "COPY_CODE" ? copyCodeLabel || "Copiar código" : b.text || "Botão";
          return (
            <div key={i} className="flex items-center justify-center gap-1.5 border-t border-neutral-200 py-2 text-[13px] font-medium text-sky-600">
              <Icon className="size-3.5" /> {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MediaHeader({ format, url, fileName }: { format: MediaFormat; url?: string; fileName?: string }) {
  if (url && format === "IMAGE") return <img src={url} alt="" className="max-h-48 w-full rounded-md object-cover" />;
  if (url && format === "VIDEO") return <video src={url} className="max-h-48 w-full rounded-md bg-black object-cover" muted controls />;
  const Icon = MEDIA_ICON[format];
  return (
    <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-md bg-neutral-200 text-xs text-neutral-500">
      <Icon className="size-6" />
      <span className="max-w-full truncate px-2">{format === "DOCUMENT" && fileName ? fileName : HEADER_LABELS[format]}</span>
    </div>
  );
}
