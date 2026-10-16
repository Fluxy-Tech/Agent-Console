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
import { api, ApiError } from "@/lib/api";
import type { TicketCloseTag } from "@/types/domain";

interface TagFormDialogProps {
  serviceIslandId: string;
  tag?: TicketCloseTag;
  onSaved: () => void;
  trigger: React.ReactNode;
}

export function TagFormDialog({ serviceIslandId, tag, onSaved, trigger }: TagFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tag?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setName(tag?.name ?? "");
  }, [open, tag]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (tag) {
        await api.put(`/api/service-islands/${serviceIslandId}/tags/${tag.id}`, { name });
      } else {
        await api.post(`/api/service-islands/${serviceIslandId}/tags`, { name });
      }

      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a tag.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tag ? "Editar tag" : "Nova tag de fechamento"}</DialogTitle>
          <DialogDescription>
            Tags de fechamento classificam o motivo de encerramento de um ticket nesta ilha.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-name">Nome</Label>
            <Input id="tag-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button loading={saving} type="submit" disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando…" : tag ? "Salvar alterações" : "Criar tag"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
