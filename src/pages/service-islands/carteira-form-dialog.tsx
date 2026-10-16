import { type FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { Carteira, Queue } from "@/types/domain";

interface CarteiraFormDialogProps {
  serviceIslandId: string;
  queues: Queue[];
  carteira?: Carteira;
  onSaved: () => void;
  trigger: React.ReactNode;
}

/// Criar/editar carteira — só filas com "Liberar fila para carteira" ligado
/// aparecem (a fila atual de uma carteira existente continua na lista mesmo
/// que tenha sido desliberada depois).
export function CarteiraFormDialog({ serviceIslandId, queues, carteira, onSaved, trigger }: CarteiraFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(carteira?.name ?? "");
  const [queueId, setQueueId] = useState(carteira?.queueId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableQueues = queues.filter((q) => q.carteiraEnabled || q.id === carteira?.queueId);

  useEffect(() => {
    if (open) {
      setName(carteira?.name ?? "");
      setQueueId(carteira?.queueId ?? "");
      setError(null);
    }
  }, [open, carteira]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!queueId) {
      setError("Selecione a fila da carteira.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const body = { name, queueId };
      if (carteira) {
        await api.put(`/api/service-islands/${serviceIslandId}/carteiras/${carteira.id}`, body);
      } else {
        await api.post(`/api/service-islands/${serviceIslandId}/carteiras`, body);
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a carteira.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{carteira ? "Editar carteira" : "Nova carteira"}</DialogTitle>
          <DialogDescription>
            Contatos desta carteira sempre são direcionados para a fila escolhida quando abrirem um novo atendimento.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carteira-name">Nome</Label>
            <Input id="carteira-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Fila</Label>
            <Select value={queueId} onValueChange={setQueueId} disabled={availableQueues.length === 0}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a fila" />
              </SelectTrigger>
              <SelectContent>
                {availableQueues.map((queue) => (
                  <SelectItem key={queue.id} value={queue.id}>
                    {queue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableQueues.length === 0 && (
              <p className="text-muted-foreground text-xs">
                Nenhuma fila liberada para carteira. Ative "Liberar fila para carteira" em alguma fila na aba Filas.
              </p>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button loading={saving} type="submit" disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando…" : carteira ? "Salvar alterações" : "Criar carteira"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
