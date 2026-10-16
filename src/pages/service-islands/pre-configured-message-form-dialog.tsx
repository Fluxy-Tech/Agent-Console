import { type FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { PreConfiguredMessage, Queue } from "@/types/domain";

interface PreConfiguredMessageFormDialogProps {
  serviceIslandId: string;
  queues: Queue[];
  message?: PreConfiguredMessage;
  onSaved: () => void;
  trigger: React.ReactNode;
}

export function PreConfiguredMessageFormDialog({
  serviceIslandId,
  queues,
  message,
  onSaved,
  trigger,
}: PreConfiguredMessageFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(message?.name ?? "");
  const [content, setContent] = useState(message?.content ?? "");
  const [queueIds, setQueueIds] = useState<Set<string>>(new Set(message?.queues.map((q) => q.id) ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(message?.name ?? "");
      setContent(message?.content ?? "");
      setQueueIds(new Set(message?.queues.map((q) => q.id) ?? []));
      setError(null);
    }
  }, [open, message]);

  function toggleQueue(queueId: string, checked: boolean) {
    setQueueIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(queueId);
      else next.delete(queueId);
      return next;
    });
  }

  const allSelected = queues.length > 0 && queueIds.size === queues.length;
  const someSelected = queueIds.size > 0 && !allSelected;

  function toggleAll(checked: boolean) {
    setQueueIds(checked ? new Set(queues.map((q) => q.id)) : new Set());
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { name, content, queueIds: Array.from(queueIds) };
      if (message) {
        await api.put(`/api/service-islands/${serviceIslandId}/pre-configured-messages/${message.id}`, payload);
      } else {
        await api.post(`/api/service-islands/${serviceIslandId}/pre-configured-messages`, payload);
      }

      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a mensagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{message ? "Editar mensagem" : "Nova mensagem pré-configurada"}</DialogTitle>
          <DialogDescription>
            Mensagens prontas que o atendente pode usar ao responder um ticket. Use **texto** pra deixar um trecho em
            negrito.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pcm-name">Nome</Label>
            <Input id="pcm-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pcm-content">Mensagem</Label>
            <Textarea
              id="pcm-content"
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="pcm-all-queues"
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => toggleAll(checked === true)}
                disabled={queues.length === 0}
              />
              <Label htmlFor="pcm-all-queues" className="text-sm font-medium">
                Selecionar todas as filas
              </Label>
            </div>
            <div className="border-border flex max-h-40 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
              {queues.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma fila cadastrada nesta ilha.</p>}
              {queues.map((queue) => (
                <div key={queue.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`pcm-queue-${queue.id}`}
                    checked={queueIds.has(queue.id)}
                    onCheckedChange={(checked) => toggleQueue(queue.id, checked === true)}
                  />
                  <Label htmlFor={`pcm-queue-${queue.id}`} className="text-sm font-normal">
                    {queue.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saving} type="submit" disabled={saving || queueIds.size === 0}>
              <Save className="size-4" /> {saving ? "Salvando…" : message ? "Salvar alterações" : "Criar mensagem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
