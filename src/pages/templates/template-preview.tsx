import { Copy, ExternalLink, Phone, Reply } from "lucide-react";
import fundoWhatsApp from "@/assets/FundoWhatsApp.jpg";
import { fillExamples, type TemplateButton } from "./template-utils";

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
}: {
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons: TemplateButton[];
  headerExample?: string;
  bodyExamples?: string[];
  /// Cabeçalho de mídia (só na listagem; o editor não cria).
  mediaHeader?: string;
}) {
  return (
    <div
      className="flex min-h-40 flex-col justify-start rounded-lg bg-cover bg-center p-3"
      style={{ backgroundImage: `url(${fundoWhatsApp})` }}
    >
      <div className="flex max-w-[92%] flex-col overflow-hidden rounded-lg bg-white text-[13px] text-neutral-900 shadow-sm">
        <div className="flex flex-col gap-1 p-2">
          {mediaHeader && (
            <div className="flex h-24 items-center justify-center rounded-md bg-neutral-200 text-xs text-neutral-500">{mediaHeader}</div>
          )}
          {headerText && <p className="font-semibold">{fillExamples(headerText, headerExample ? [headerExample] : [])}</p>}
          <p className="break-words whitespace-pre-wrap">{bodyText ? fillExamples(bodyText, bodyExamples ?? []) : "Texto da mensagem"}</p>
          {footerText && <p className="text-[11px] text-neutral-500">{footerText}</p>}
        </div>
        {buttons.map((b, i) => {
          const Icon = BUTTON_ICON[b.type];
          const label = b.type === "COPY_CODE" ? "Copiar código" : b.text || "Botão";
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
