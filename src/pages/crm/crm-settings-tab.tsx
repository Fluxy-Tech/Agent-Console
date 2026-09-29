import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CalendarDays, Save, SquareKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCan } from "@/hooks/use-can";
import { PermissionAction } from "@/domain/permission-action";
import { api, ApiError } from "@/lib/api";
import type { CrmSettings } from "@/types/domain";

type SettingsUser = CrmSettings["users"][number];

function UserChecklist({
  idPrefix,
  users,
  selected,
  onChange,
  disabled,
}: {
  idPrefix: string;
  users: SettingsUser[];
  selected: string[];
  onChange: (userIds: string[]) => void;
  disabled: boolean;
}) {
  if (users.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhum usuário ativo nesta empresa.</p>;
  }

  const allSelected = users.every((u) => selected.includes(u.userId));

  function toggle(userId: string, checked: boolean) {
    onChange(checked ? [...selected, userId] : selected.filter((id) => id !== userId));
  }

  return (
    <div className="border-border flex flex-col rounded-lg border">
      <label className="bg-primary/5 flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm font-medium">
        <Checkbox
          checked={allSelected}
          disabled={disabled}
          onCheckedChange={(v) => onChange(v === true ? users.map((u) => u.userId) : [])}
        />
        Selecionar todos
      </label>
      <div className="flex max-h-64 flex-col overflow-y-auto">
        {users.map((u) => (
          <label
            key={u.userId}
            htmlFor={`${idPrefix}-${u.userId}`}
            className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
          >
            <Checkbox
              id={`${idPrefix}-${u.userId}`}
              checked={selected.includes(u.userId)}
              disabled={disabled}
              onCheckedChange={(v) => toggle(u.userId, v === true)}
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{u.name}</p>
              <p className="text-muted-foreground truncate text-xs">{u.email}</p>
            </div>
          </label>
        ))}
      </div>
      <p className="text-muted-foreground border-t px-3 py-2 text-xs">
        {selected.length} de {users.length} usuário(s) selecionado(s)
      </p>
    </div>
  );
}

function AgentVisibilitySwitch({
  checked,
  onChange,
  disabled,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="data-[state=checked]:bg-[#25D366]"
      />
      <div>
        <Label className="font-bold">Visível para o agente de IA</Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}

export function CrmSettingsTab() {
  const can = useCan();
  const canWrite = can(PermissionAction.CRM_WRITE);
  const { data, mutate } = useSWR<CrmSettings>("/api/crm/settings");

  const [calendarUserIds, setCalendarUserIds] = useState<string[]>([]);
  const [calendarVisibleToAgent, setCalendarVisibleToAgent] = useState(false);
  const [kanbanUserIds, setKanbanUserIds] = useState<string[]>([]);
  // String pra permitir o campo vazio (= sem limite) enquanto digita.
  const [kanbanMaxCards, setKanbanMaxCards] = useState("");
  const [kanbanVisibleToAgent, setKanbanVisibleToAgent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setCalendarUserIds(data.calendar.userIds);
    setCalendarVisibleToAgent(data.calendar.visibleToAgent);
    setKanbanUserIds(data.kanban.userIds);
    setKanbanMaxCards(data.kanban.maxCardsPerUser ? String(data.kanban.maxCardsPerUser) : "");
    setKanbanVisibleToAgent(data.kanban.visibleToAgent);
  }, [data]);

  const disabled = !canWrite || saving;
  const maxCardsInvalid =
    kanbanMaxCards !== "" && !(Number.isInteger(Number(kanbanMaxCards)) && Number(kanbanMaxCards) >= 1);

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await api.put<CrmSettings>("/api/crm/settings", {
        calendar: { userIds: calendarUserIds, visibleToAgent: calendarVisibleToAgent },
        kanban: {
          userIds: kanbanUserIds,
          maxCardsPerUser: kanbanMaxCards === "" ? null : Number(kanbanMaxCards),
          visibleToAgent: kanbanVisibleToAgent,
        },
      });
      await mutate(saved, { revalidate: false });
      toast.success("Configurações salvas.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return <div className="text-muted-foreground p-2 text-sm">Carregando…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <CardTitle>Usuários do calendário</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Escolha quais usuários desta empresa podem ser inseridos nos eventos do calendário.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <Label className="font-bold">Usuários permitidos</Label>
            <p className="text-muted-foreground text-xs">
              Só os usuários marcados poderão ser inseridos em um evento.
            </p>
            <UserChecklist
              idPrefix="calendar-user"
              users={data.users}
              selected={calendarUserIds}
              onChange={setCalendarUserIds}
              disabled={disabled}
            />
          </div>

          <AgentVisibilitySwitch
            checked={calendarVisibleToAgent}
            onChange={setCalendarVisibleToAgent}
            disabled={disabled}
            description="O agente de IA pode ver esses usuários ao trabalhar com eventos do calendário."
          />
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <SquareKanban className="size-5" />
            </div>
            <div>
              <CardTitle>Usuários do Kanban</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Escolha quais usuários desta empresa podem ser inseridos nos cards do Kanban e quantos cards cada um
                pode ter.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <Label className="font-bold">Usuários permitidos</Label>
            <p className="text-muted-foreground text-xs">Só os usuários marcados poderão ser inseridos em um card.</p>
            <UserChecklist
              idPrefix="kanban-user"
              users={data.users}
              selected={kanbanUserIds}
              onChange={setKanbanUserIds}
              disabled={disabled}
            />
          </div>

          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="kanban-max-cards" className="font-bold">
              Limite de cards por usuário
            </Label>
            <p className="text-muted-foreground text-xs">Deixe em branco para não limitar.</p>
            <Input
              id="kanban-max-cards"
              type="number"
              min={1}
              step={1}
              placeholder="Sem limite"
              disabled={disabled}
              value={kanbanMaxCards}
              onChange={(e) => setKanbanMaxCards(e.target.value)}
            />
            {maxCardsInvalid && <p className="text-destructive text-xs">Informe um número inteiro a partir de 1.</p>}
          </div>

          <AgentVisibilitySwitch
            checked={kanbanVisibleToAgent}
            onChange={setKanbanVisibleToAgent}
            disabled={disabled}
            description="O agente de IA pode ver esses usuários ao trabalhar com os cards do Kanban."
          />
        </CardContent>
      </Card>

      {canWrite && (
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={saving || maxCardsInvalid}>
            <Save className="size-4" /> {saving ? "Salvando…" : "Salvar configurações"}
          </Button>
        </div>
      )}
    </div>
  );
}
