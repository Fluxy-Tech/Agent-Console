import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { ListChecks, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Queue, QueueListResult, Channel } from "@/types/domain";

interface DefaultQueueDialogProps {
  channel: Channel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/// Modal pra escolher a fila (Queue) que recebe o atendimento quando
/// openAgent=false — grava em Channel.idServiceIslandDefault. Lista
/// as filas da ilha deste canal (mesma paginação simples do restante da UI,
/// uma ilha dificilmente passa de 50 filas).
export function DefaultQueueDialog({ channel, open, onOpenChange, onSaved }: DefaultQueueDialogProps) {
  const islandId = channel.serviceIsland?.id;
  const { data: queues } = useSWR<QueueListResult>(
    open && islandId ? `/api/service-islands/${islandId}/queues?pageSize=50` : null,
  );

  const [selectedId, setSelectedId] = useState<string | null>(channel.idServiceIslandDefault);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza a seleção com o valor salvo toda vez que o modal reabre.
  function handleOpenChange(next: boolean) {
    if (next) {
      setSelectedId(channel.idServiceIslandDefault);
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!selectedId) return;
    setError(null);
    setSaving(true);
    try {
      await api.put(`/api/channels/${channel.id}`, { idServiceIslandDefault: selectedId });
      onSaved();
      toast.success("Fila de encaminhamento atualizada.");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a fila.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fila de atendimento humano</DialogTitle>
          <DialogDescription>
            Com o agente desativado para este canal, toda mensagem recebida abre um ticket direto na fila escolhida
            aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {queues?.items.map((queue: Queue) => {
            const isSelected = queue.id === selectedId;
            return (
              <button
                key={queue.id}
                type="button"
                onClick={() => setSelectedId(queue.id)}
                className={cn(
                  "border-border flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  isSelected ? "bg-primary/5 border-primary/30" : "hover:bg-accent",
                )}
              >
                <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm">
                  <ListChecks className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{queue.name}</p>
                </div>
                {queue.isDefault && (
                  <Badge variant="outline" className="shrink-0">
                    Default
                  </Badge>
                )}
                {isSelected && <Badge className="bg-primary/10 text-primary border-transparent shrink-0">Selecionada</Badge>}
              </button>
            );
          })}
          {queues && queues.items.length === 0 && (
            <p className="text-muted-foreground py-2 text-center text-sm">Nenhuma fila cadastrada nesta ilha.</p>
          )}
          {!queues && <p className="text-muted-foreground py-2 text-center text-sm">Carregando filas…</p>}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={saving || !selectedId} onClick={handleConfirm}>
            <Save className="size-4" /> {saving ? "Salvando…" : "Salvar fila"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
