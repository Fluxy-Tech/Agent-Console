import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, Clock, Save, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCan } from "@/hooks/use-can";
import { PermissionAction, ROLE_LABELS } from "@/domain/permission-action";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type { Member, Queue, ServiceIsland } from "@/types/domain";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function ServiceIslandQueueDetailPage() {
  const { islandId, queueId } = useParams<{ islandId: string; queueId: string }>();
  const navigate = useNavigate();
  const can = useCan();
  const canWrite = can(PermissionAction.QUEUES_WRITE);
  const activeCompanyId = useAppSelector((s) => s.activeCompany?.id);

  const { data: island } = useSWR<ServiceIsland>(islandId ? `/api/service-islands/${islandId}` : null);
  const { data: queue, mutate } = useSWR<Queue>(
    islandId && queueId ? `/api/service-islands/${islandId}/queues/${queueId}` : null,
  );
  const { data: members } = useSWR<Member[]>(activeCompanyId ? `/api/companies/${activeCompanyId}/members` : null);

  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false);
  const [businessHoursStart, setBusinessHoursStart] = useState("08:00");
  const [businessHoursEnd, setBusinessHoursEnd] = useState("18:00");
  const [businessDays, setBusinessDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);
  const [carteiraEnabled, setCarteiraEnabled] = useState(false);
  const [attendantSearch, setAttendantSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (queue) {
      setName(queue.name);
      setIsActive(queue.isActive);
      setBusinessHoursEnabled(queue.businessHoursEnabled);
      setBusinessHoursStart(queue.businessHoursStart ?? "08:00");
      setBusinessHoursEnd(queue.businessHoursEnd ?? "18:00");
      setBusinessDays(queue.businessDays);
      setMemberUserIds(queue.members?.map((m) => m.userId) ?? []);
      setCarteiraEnabled(queue.carteiraEnabled);
    }
  }, [queue]);

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
      await api.put(`/api/service-islands/${islandId}/queues/${queueId}`, {
        name,
        isActive,
        businessHoursEnabled,
        businessHoursStart: businessHoursEnabled ? businessHoursStart : undefined,
        businessHoursEnd: businessHoursEnabled ? businessHoursEnd : undefined,
        businessDays,
        memberUserIds,
        carteiraEnabled,
      });
      await mutate();
      toast.success("Fila atualizada.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a fila.");
    } finally {
      setSaving(false);
    }
  }

  if (!queue || !island) return <div className="text-muted-foreground p-6 text-sm">Carregando…</div>;

  const filteredMembers = (members ?? []).filter((m) =>
    m.user.name.toLowerCase().includes(attendantSearch.toLowerCase()),
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
      <PageBreadcrumb
        items={[
          { label: "Ilhas de Atendimento", to: "/service-island" },
          { label: island.name, to: `/service-island/${island.id}` },
          { label: queue.name },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(`/service-island/${island.id}`)}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Editar fila</h1>
            <p className="text-muted-foreground mt-1 text-sm">Configure as informações, horários e atendentes da fila.</p>
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(`/service-island/${island.id}`)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="size-4" /> {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        )}
      </div>

      <Card className="shadow-xl">
        <CardContent className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold">Informações da fila</h2>
              <p className="text-muted-foreground text-sm">Defina o nome e a situação desta fila.</p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="queue-name">Nome da fila</Label>
                <Input id="queue-name" required disabled={!canWrite} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex items-center gap-3 sm:w-64 sm:justify-between">
                <div>
                  <Label>Fila ativa</Label>
                  <p className="text-muted-foreground text-xs">Disponível para receber atendimentos</p>
                </div>
                <Switch checked={isActive} disabled={!canWrite} onCheckedChange={setIsActive} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Liberar fila para carteira</Label>
                <p className="text-muted-foreground text-xs">
                  Permite escolher esta fila como destino de uma carteira de atendimento.
                </p>
              </div>
              <Switch checked={carteiraEnabled} disabled={!canWrite} onCheckedChange={setCarteiraEnabled} />
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t pt-6">
            <div>
              <h2 className="text-base font-semibold">Horário de atendimento</h2>
              <p className="text-muted-foreground text-sm">Defina quando esta fila estará disponível.</p>
            </div>

            <div className="border-border bg-muted/30 flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Usar horário personalizado</p>
                <p className="text-muted-foreground text-xs">
                  Quando desativado, a fila permanece disponível sem restrição de horário.
                </p>
              </div>
              <Switch checked={businessHoursEnabled} disabled={!canWrite} onCheckedChange={setBusinessHoursEnabled} />
            </div>

            {businessHoursEnabled ? (
              <div className="border-border flex flex-col gap-4 rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="queue-start">Início</Label>
                    <Input
                      id="queue-start"
                      type="time"
                      disabled={!canWrite}
                      value={businessHoursStart}
                      onChange={(e) => setBusinessHoursStart(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="queue-end">Fim</Label>
                    <Input
                      id="queue-end"
                      type="time"
                      disabled={!canWrite}
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
                        disabled={!canWrite}
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
              </div>
            ) : (
              <div className="border-border bg-muted/30 text-muted-foreground flex items-center gap-2 rounded-lg border p-4 text-sm">
                <Clock className="size-4" /> Atendimento disponível em qualquer horário
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 border-t pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Atendentes atribuídos</h2>
                <p className="text-muted-foreground text-sm">Selecione quem poderá receber atendimentos nesta fila.</p>
              </div>
              <Badge className="bg-primary/10 text-primary border-transparent shrink-0">
                {memberUserIds.length} selecionado{memberUserIds.length === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Buscar atendente..."
                className="pl-9"
                value={attendantSearch}
                onChange={(e) => setAttendantSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              {filteredMembers.map((member) => {
                const checked = memberUserIds.includes(member.userId);
                return (
                  <label
                    key={member.userId}
                    className={cn(
                      "border-border flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3",
                      checked && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm text-sm font-medium">
                        {member.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{member.user.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {ROLE_LABELS[member.role]} · {member.user.email}
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      disabled={!canWrite}
                      checked={checked}
                      onChange={() => toggleMember(member.userId)}
                    />
                  </label>
                );
              })}
              {filteredMembers.length === 0 && (
                <p className="text-muted-foreground py-2 text-center text-sm">Nenhum atendente encontrado.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}
