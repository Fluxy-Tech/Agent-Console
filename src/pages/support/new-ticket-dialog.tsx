import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SupportSeverity } from "@/types/domain";
import { PendingFileChips, useSupportFilePicker } from "./support-attachments";
import { SEVERITIES, SEVERITY_INFO, uploadSupportFiles } from "./support-config";

export function NewTicketDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticketId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<SupportSeverity | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useSupportFilePicker(files, setFiles);

  function reset() {
    setTitle("");
    setDescription("");
    setSeverity(null);
    setFiles([]);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!severity) {
      setError("Escolha a classificação do problema.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const attachments = await uploadSupportFiles(files);
      const ticket = await api.post<{ id: string; code: number }>("/api/support/tickets", {
        title,
        description,
        severity,
        attachments,
      });
      toast.success(`Chamado #${ticket.code} aberto. O time de apoio vai responder por aqui.`);
      reset();
      onCreated(ticket.id);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Não foi possível abrir o chamado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Abrir chamado de suporte</DialogTitle>
            <DialogDescription>
              Descreva o problema com o máximo de detalhes. Prints e gravações de tela ajudam o time de apoio a
              resolver mais rápido.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label>Classificação</Label>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Classificação do problema">
              {SEVERITIES.map((key) => {
                const info = SEVERITY_INFO[key];
                const selected = severity === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSeverity(key)}
                    className={cn(
                      "border-border hover:bg-accent/40 flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                      selected && info.accentClassName,
                    )}
                  >
                    <span className="text-sm font-semibold">
                      {info.label} · {info.name}
                    </span>
                    <span className="text-muted-foreground text-xs">{info.summary}</span>
                  </button>
                );
              })}
            </div>
            {severity && <p className="text-muted-foreground text-xs">{SEVERITY_INFO[severity].impact}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="support-title">Título</Label>
            <Input
              id="support-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Campanha agendada não foi disparada"
              maxLength={150}
              required
              disabled={submitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="support-description">Descrição</Label>
            <Textarea
              id="support-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="O que aconteceu, em qual tela, desde quando, e o que você esperava que acontecesse."
              rows={6}
              required
              disabled={submitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Anexos</Label>
            {picker.input}
            <PendingFileChips files={files} onChange={setFiles} disabled={submitting} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={submitting || picker.full}
              onClick={picker.open}
            >
              <Paperclip className="size-4" /> Anexar documentos
            </Button>
            <p className="text-muted-foreground text-xs">
              Até 10 arquivos de 25 MB: PDF, Word, Excel, imagens, vídeos, TXT/CSV/JSON ou ZIP.
            </p>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Abrindo…" : "Abrir chamado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
