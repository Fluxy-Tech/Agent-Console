import { useRef } from "react";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Paperclip, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupportAttachment } from "@/types/domain";
import { SUPPORT_ATTACHMENT_ACCEPT, formatFileSize, validateSupportFile } from "./support-config";

function iconFor(contentType: string) {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (contentType.startsWith("video/")) return Video;
  return FileText;
}

/// Anexos já gravados (abertura ou mensagem). Imagens ganham miniatura; o
/// resto vira um link de download com nome e tamanho.
export function AttachmentList({ attachments, className }: { attachments: SupportAttachment[]; className?: string }) {
  if (attachments.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {attachments.map((attachment) => {
        if (attachment.contentType.startsWith("image/")) {
          return (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              title={attachment.fileName}
              className="border-border block overflow-hidden rounded-lg border"
            >
              <img src={attachment.url} alt={attachment.fileName} className="h-24 w-32 object-cover" />
            </a>
          );
        }
        const Icon = iconFor(attachment.contentType);
        return (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="border-border bg-background hover:bg-accent flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors"
          >
            <Icon className="text-primary size-4 shrink-0" />
            <span className="min-w-0 truncate font-medium">{attachment.fileName}</span>
            <span className="text-muted-foreground shrink-0">{formatFileSize(attachment.size)}</span>
          </a>
        );
      })}
    </div>
  );
}

/// Input de arquivo escondido + validação (tipo/tamanho, máx. 10). Devolve o
/// elemento pra renderizar e a função que abre o seletor — quem usa decide
/// onde fica o botão. O envio de verdade acontece no submit
/// (uploadSupportFiles).
export function useSupportFilePicker(files: File[], onChange: (files: File[]) => void) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelected(list: FileList | null) {
    if (!list) return;
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      const error = validateSupportFile(file);
      if (error) toast.error(error);
      else accepted.push(file);
    }
    onChange([...files, ...accepted].slice(0, 10));
    if (inputRef.current) inputRef.current.value = "";
  }

  return {
    input: (
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={SUPPORT_ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(event) => handleSelected(event.target.files)}
      />
    ),
    open: () => inputRef.current?.click(),
    full: files.length >= 10,
  };
}

/// Chips dos arquivos escolhidos (ainda não enviados), com botão de remover.
export function PendingFileChips({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {files.map((file, index) => (
        <span
          key={`${file.name}-${index}`}
          className="bg-muted flex max-w-full items-center gap-1.5 rounded-md py-1 pr-1 pl-2 text-xs"
        >
          <Paperclip className="size-3 shrink-0" />
          <span className="min-w-0 truncate">{file.name}</span>
          <span className="text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
          <button
            type="button"
            className="hover:bg-background rounded-sm p-0.5"
            aria-label={`Remover ${file.name}`}
            disabled={disabled}
            onClick={() => onChange(files.filter((_, i) => i !== index))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
