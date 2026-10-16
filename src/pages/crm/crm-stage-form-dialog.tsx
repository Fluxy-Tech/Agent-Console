import { type FormEvent, type ReactNode, useState } from "react";
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
import { api, ApiError } from "@/lib/api";

interface CrmStageFormDialogProps {
  nextPosition: number;
  onSaved: () => void;
  trigger: ReactNode;
}

/// Dialog de "Novo estágio" — nome + posição (inteiro >= 1, ver
/// crm-service.ts#createStage pro deslocamento automático quando a posição
/// já está ocupada por outro estágio).
export function CrmStageFormDialog({ nextPosition, onSaved, trigger }: CrmStageFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [nameStage, setNameStage] = useState("");
  const [position, setPosition] = useState(nextPosition);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setNameStage("");
      setPosition(nextPosition);
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/api/crm/stages", { nameStage, position });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o estágio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo estágio</DialogTitle>
          <DialogDescription>Cria uma nova coluna no Kanban do CRM.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stage-name">Nome</Label>
            <Input id="stage-name" required value={nameStage} onChange={(e) => setNameStage(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stage-position">Posição</Label>
            <Input
              id="stage-position"
              type="number"
              min={1}
              required
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button loading={saving} type="submit" disabled={saving}>
            <Save className="size-4" /> {saving ? "Criando…" : "Criar estágio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
