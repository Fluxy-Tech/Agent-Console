import { useRef, type ReactNode } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/// Mesmos limites do Agent-Api (application/profile/image-upload.ts) — aqui só
/// para avisar antes do upload; quem valida de verdade é o backend.
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/// Erro de validação local da imagem escolhida, ou null se ela pode ser enviada.
export function validateImageFile(file: File): string | null {
  if (!IMAGE_ACCEPT.split(",").includes(file.type)) return "Formato não suportado. Use PNG, JPG, WEBP ou GIF.";
  if (file.size > IMAGE_MAX_BYTES) return "A imagem pode ter no máximo 2 MB.";
  return null;
}

/// Prévia quadrada + botões de trocar/remover. Só escolhe o arquivo — o envio
/// pro S3 acontece no "Salvar" de quem usa, junto com o resto do formulário.
export function ImageUploadField({
  previewUrl,
  fallback,
  disabled,
  onSelect,
  onRemove,
}: {
  previewUrl: string | null;
  fallback: ReactNode;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-4">
      <div className="bg-primary/15 text-primary flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg text-2xl font-semibold">
        {previewUrl ? <img src={previewUrl} alt="" className="size-full object-cover" /> : fallback}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-4" /> {previewUrl ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="size-4" /> Remover
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">PNG, JPG, WEBP ou GIF, até 2 MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/// Envia a imagem direto pro S3 pela URL presignada (mesmo fluxo dos anexos
/// do CRM) e devolve a chave a confirmar no Agent-Api.
export async function uploadImage(
  presign: (input: { fileName: string; contentType: string }) => Promise<{ uploadUrl: string; s3Key: string }>,
  file: File,
): Promise<string> {
  const { uploadUrl, s3Key } = await presign({ fileName: file.name, contentType: file.type });
  const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!response.ok) throw new Error("Falha ao enviar a imagem.");
  return s3Key;
}
