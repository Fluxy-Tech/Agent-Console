import { type ReactNode, useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import type { TargetCarteira } from "@/types/domain";

interface TargetCarteirasDialogProps {
  targetId: string;
  canWrite: boolean;
  trigger: ReactNode;
}

/// Checkbox com todas as carteiras da empresa — salvar manda a lista
/// completa de marcadas (PUT /api/targets/:id/carteiras).
export function TargetCarteirasDialog({ targetId, canWrite, trigger }: TargetCarteirasDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: carteiras, mutate } = useSWR<TargetCarteira[]>(open ? `/api/targets/${targetId}/carteiras` : null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (carteiras) setSelected(new Set(carteiras.filter((c) => c.checked).map((c) => c.id)));
  }, [carteiras]);

  function toggle(carteiraId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(carteiraId);
      else next.delete(carteiraId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.put<TargetCarteira[]>(`/api/targets/${targetId}/carteiras`, {
        carteiraIds: [...selected],
      });
      await mutate(updated, { revalidate: false });
      toast.success("Carteiras do contato atualizadas.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar as carteiras.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carteiras de atendimento</DialogTitle>
          <DialogDescription>
            Marque as carteiras deste contato. Nos próximos atendimentos ele vai direto para a fila da carteira.
          </DialogDescription>
        </DialogHeader>

        {!carteiras ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : carteiras.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma carteira cadastrada. Crie uma em Ilhas de Atendimento → Configurações Gerais.
          </p>
        ) : (
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {carteiras.map((carteira) => (
              <label
                key={carteira.id}
                className="hover:bg-muted/50 flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <Checkbox
                  checked={selected.has(carteira.id)}
                  disabled={!canWrite}
                  onCheckedChange={(v) => toggle(carteira.id, v === true)}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{carteira.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {carteira.queue.serviceIsland.name} · Fila {carteira.queue.name}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        {canWrite && carteiras && carteiras.length > 0 && (
          <Button loading={saving} onClick={handleSave} disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
