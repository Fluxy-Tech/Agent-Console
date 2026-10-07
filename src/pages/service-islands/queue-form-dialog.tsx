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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import type { Member, Queue } from "@/types/domain";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface QueueFormDialogProps {
  serviceIslandId: string;
  queue?: Queue;
  members: Member[];
  onSaved: () => void;
  trigger: React.ReactNode;
}

export function QueueFormDialog({ serviceIslandId, queue, members, onSaved, trigger }: QueueFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(queue?.name ?? "");
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(queue?.businessHoursEnabled ?? false);
  const [businessHoursStart, setBusinessHoursStart] = useState(queue?.businessHoursStart ?? "08:00");
  const [businessHoursEnd, setBusinessHoursEnd] = useState(queue?.businessHoursEnd ?? "18:00");
  const [businessDays, setBusinessDays] = useState<number[]>(queue?.businessDays ?? [1, 2, 3, 4, 5]);
  const [memberUserIds, setMemberUserIds] = useState<string[]>(queue?.members?.map((m) => m.userId) ?? []);
  const [carteiraEnabled, setCarteiraEnabled] = useState(queue?.carteiraEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && queue) {
      setName(queue.name);
      setBusinessHoursEnabled(queue.businessHoursEnabled);
      setBusinessHoursStart(queue.businessHoursStart ?? "08:00");
      setBusinessHoursEnd(queue.businessHoursEnd ?? "18:00");
      setBusinessDays(queue.businessDays);
      setMemberUserIds(queue.members?.map((m) => m.userId) ?? []);
      setCarteiraEnabled(queue.carteiraEnabled);
    }
  }, [open, queue]);

  function toggleDay(day: number) {
    setBusinessDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function toggleMember(userId: string) {
    setMemberUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        name,
        businessHoursEnabled,
        businessHoursStart: businessHoursEnabled ? businessHoursStart : undefined,
        businessHoursEnd: businessHoursEnabled ? businessHoursEnd : undefined,
        businessDays,
        memberUserIds,
        carteiraEnabled,
      };

      if (queue) {
        await api.put(`/api/service-islands/${serviceIslandId}/queues/${queue.id}`, body);
      } else {
        await api.post(`/api/service-islands/${serviceIslandId}/queues`, body);
      }

      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a fila.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{queue ? "Editar fila" : "Nova fila"}</DialogTitle>
          <DialogDescription>Configure o nome, horário de atendimento e os atendentes desta fila.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="queue-name">Nome</Label>
            <Input id="queue-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            <Label>Horário de atendimento personalizado</Label>
            <Switch checked={businessHoursEnabled} onCheckedChange={setBusinessHoursEnabled} />
          </div>

          {businessHoursEnabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="queue-start">Início</Label>
                  <Input
                    id="queue-start"
                    type="time"
                    value={businessHoursStart}
                    onChange={(e) => setBusinessHoursStart(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="queue-end">Fim</Label>
                  <Input
                    id="queue-end"
                    type="time"
                    value={businessHoursEnd}
                    onChange={(e) => setBusinessHoursEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Dias</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "rounded-sm border px-3 py-1 text-xs font-medium transition-colors",
                        businessDays.includes(day)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Liberar fila para carteira</Label>
              <p className="text-muted-foreground text-xs">
                Permite escolher esta fila como destino de uma carteira de atendimento.
              </p>
            </div>
            <Switch checked={carteiraEnabled} onCheckedChange={setCarteiraEnabled} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Atendentes</Label>
            <div className="flex flex-col gap-1 rounded-md border p-2">
              {members.map((member) => (
                <label key={member.userId} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={memberUserIds.includes(member.userId)}
                    onChange={() => toggleMember(member.userId)}
                  />
                  {member.user.name}
                </label>
              ))}
              {members.length === 0 && <p className="text-muted-foreground text-xs">Nenhum usuário nesta empresa.</p>}
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando…" : queue ? "Salvar alterações" : "Criar fila"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
