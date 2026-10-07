import { useEffect, useState } from "react";
import { validateImageFile } from "@/components/image-upload-field";

/// Rascunho da imagem de um formulário (avatar/logo) até o "Salvar": arquivo
/// novo escolhido, remoção pedida, ou nada (mantém a atual).
export function useImageDraft(currentUrl: string | null) {
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return {
    previewUrl: file ? objectUrl : removed ? null : currentUrl,
    dirty: Boolean(file) || removed,
    /// Devolve a mensagem de erro se o arquivo não for aceito.
    select(next: File): string | null {
      const error = validateImageFile(next);
      if (error) return error;
      setFile(next);
      setRemoved(false);
      return null;
    },
    remove() {
      setFile(null);
      setRemoved(true);
    },
    reset() {
      setFile(null);
      setRemoved(false);
    },
    /// Valor a mandar pro Agent-Api: chave nova (após o upload), null pra
    /// remover, undefined pra manter.
    async resolve(upload: (file: File) => Promise<string>): Promise<string | null | undefined> {
      if (file) return upload(file);
      return removed ? null : undefined;
    },
  };
}
