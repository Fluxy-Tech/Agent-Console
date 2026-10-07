import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Lock, Save } from "lucide-react";
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
import { api, ApiError } from "@/lib/api";
import type { Agent } from "@/types/domain";

interface BlockAgentsDialogProps {
  targetId: string;
  targetName: string;
  blockedAgentIds: string[];
  disabled: boolean;
  onSaved: () => void;
}

/// Modal do cadeado na tabela de Contatos — escolhe de quais agentes este
/// contato fica bloqueado. Enquanto bloqueado para um agente, o
/// Inbound-Service responde com Agent.blockedMessage em vez de rotear pra
/// IA/atendente (ver Agent-Api PATCH /targets/:id/blocked-agents). Só
/// Supervisor/Gerente (CONTACTS_WRITE) chegam com disabled=false.
export function BlockAgentsDialog({ targetId, targetName, blockedAgentIds, disabled, onSaved }: BlockAgentsDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: agents } = useSWR<Agent[]>(open ? "/api/agents" : null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedIds(new Set(blockedAgentIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(agentId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(agentId);
      else next.delete(agentId);
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/api/targets/${targetId}/blocked-agents`, {
        blockedAgentIds: Array.from(selectedIds),
      });
      toast.success("Bloqueios atualizados.");
      onSaved();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar os bloqueios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={blockedAgentIds.length > 0 ? "destructive" : "outline"}
          size="icon"
          className="size-8"
          disabled={disabled}
          title={blockedAgentIds.length > 0 ? `Bloqueado para ${blockedAgentIds.length} agente(s)` : "Bloquear agentes"}
        >
          <Lock className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloquear agentes</DialogTitle>
          <DialogDescription>
            Escolha de quais agentes <strong>{targetName}</strong> fica bloqueado. Um contato bloqueado para um
            agente recebe a mensagem configurada para números bloqueados em vez de ser atendido pela IA ou por um
            atendente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {agents?.map((agent) => {
            const checked = selectedIds.has(agent.id);
            return (
              <label
                key={agent.id}
                className="border-border flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm text-sm font-medium">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="truncate text-sm font-medium">{agent.name}</p>
                </div>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggle(agent.id, v === true)}
                  aria-label={`Bloquear ${targetName} para ${agent.name}`}
                />
              </label>
            );
          })}
          {agents && agents.length === 0 && (
            <p className="text-muted-foreground py-2 text-center text-sm">Nenhum agente cadastrado.</p>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
