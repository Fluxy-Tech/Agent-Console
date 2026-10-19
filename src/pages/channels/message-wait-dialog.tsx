import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Hourglass, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { Channel } from "@/types/domain";

const MIN_SECONDS = 1;
const MAX_SECONDS = 120;

interface MessageWaitDialogProps {
  channel: Channel;
  disabled: boolean;
  onSaved: () => void;
  trigger: React.ReactNode;
}

/// Modal "Tempo de aguardo de mensagem" — janela (segundos) em que o
/// Inbound-Service junta as mensagens seguidas do contato antes de mandar pro
/// agente (ver Channel.messageWaitSeconds no schema). Salva no PUT do canal.
export function MessageWaitDialog({ channel, disabled, onSaved, trigger }: MessageWaitDialogProps) {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState(channel.messageWaitSeconds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSeconds(channel.messageWaitSeconds);
      setError(null);
    }
  }, [open, channel]);

  const invalid = !Number.isInteger(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS;

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await api.put(`/api/channels/${channel.id}`, { messageWaitSeconds: seconds });
      onSaved();
      toast.success("Tempo de aguardo de mensagem atualizado.");
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Hourglass className="size-5" />
            </div>
            <div>
              <DialogTitle>Tempo de aguardo de mensagem</DialogTitle>
              <DialogDescription>
                O agente espera esse tempo por novas mensagens do contato antes de responder. Cada mensagem nova reinicia
                a contagem, e tudo que chegar nesse intervalo é respondido de uma vez.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="message-wait-seconds">Tempo em segundos</Label>
          <Input
            id="message-wait-seconds"
            type="number"
            min={MIN_SECONDS}
            max={MAX_SECONDS}
            disabled={disabled || saving}
            value={Number.isNaN(seconds) ? "" : seconds}
            onChange={(e) => setSeconds(e.target.valueAsNumber)}
          />
          <p className={invalid ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
            Entre {MIN_SECONDS} e {MAX_SECONDS} segundos.
          </p>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {!disabled && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saving} type="button" disabled={saving || invalid} onClick={handleSave}>
              <Save className="size-4" /> {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
