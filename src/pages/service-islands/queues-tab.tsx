import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { CheckCircle2, ListChecks, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/metric-card";
import { PaginationControls } from "@/components/pagination-controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";
import type { Member, QueueListResult, QueueStats } from "@/types/domain";
import { QueueFormDialog } from "./queue-form-dialog";

const ALL = "all";
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const SITUATION_OPTIONS = [
  { value: ALL, label: "Todas as situações" },
  { value: "true", label: "Ativas" },
  { value: "false", label: "Inativas" },
];

interface QueuesTabProps {
  islandId: string;
  canManageQueues: boolean;
}

export function QueuesTab({ islandId, canManageQueues }: QueuesTabProps) {
  const navigate = useNavigate();
  const activeCompanyId = useAppSelector((s) => s.activeCompany?.id);
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: members } = useSWR<Member[]>(activeCompanyId ? `/api/companies/${activeCompanyId}/members` : null);
  const { data: stats } = useSWR<QueueStats>(`/api/service-islands/${islandId}/queues/stats`);

  const listParams = new URLSearchParams();
  if (search) listParams.set("search", search);
  if (isActive !== ALL) listParams.set("isActive", isActive);
  listParams.set("page", String(page));
  listParams.set("pageSize", String(pageSize));
  const { data: queues, mutate } = useSWR<QueueListResult>(
    `/api/service-islands/${islandId}/queues?${listParams.toString()}`,
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [togglingCarteiraId, setTogglingCarteiraId] = useState<string | null>(null);

  /// Libera/bloqueia a fila como destino de carteira direto da tabela — o PUT
  /// só com carteiraEnabled não mexe nos outros campos (nem nos atendentes).
  async function handleToggleCarteira(queueId: string, carteiraEnabled: boolean) {
    setTogglingCarteiraId(queueId);
    try {
      await api.put(`/api/service-islands/${islandId}/queues/${queueId}`, { carteiraEnabled });
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar a fila.");
    } finally {
      setTogglingCarteiraId(null);
    }
  }

  // Muda de página/filtro = a seleção não corresponde mais ao que está na
  // tela — mais seguro limpar do que deixar ids "fantasma" marcados.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [queues]);

  const selectedCount = selectedIds.size;
  const allOnPageSelected = Boolean(queues?.items.length) && queues!.items.every((q) => selectedIds.has(q.id));

  function toggleSelected(queueId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(queueId);
      else next.delete(queueId);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (!queues) return;
    setSelectedIds(checked ? new Set(queues.items.map((q) => q.id)) : new Set());
  }

  /// Cada fila é excluída individualmente — o backend decide sozinho se é
  /// exclusão de verdade ou soft delete (fila com ticket vira "desabilitada":
  /// some da lista, mas o histórico de atendimento continua no banco). Segue
  /// processando as demais mesmo se uma falhar de verdade (erro de rede/
  /// permissão), e no fim resume tudo num único toast.
  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setDeleting(true);
    let deletedCount = 0;
    let disabledCount = 0;
    const failures: string[] = [];

    for (const id of ids) {
      const queue = queues?.items.find((q) => q.id === id);
      try {
        const result = await api.delete<{ softDeleted: boolean }>(`/api/service-islands/${islandId}/queues/${id}`);
        if (result.softDeleted) disabledCount++;
        else deletedCount++;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Erro desconhecido.";
        failures.push(`${queue?.name ?? id}: ${message}`);
      }
    }

    setDeleting(false);
    setSelectedIds(new Set());
    await mutate();

    if (deletedCount > 0) {
      toast.success(`${deletedCount} fila(s) excluída(s).`);
    }
    if (disabledCount > 0) {
      toast.success(`${disabledCount} fila(s) desabilitada(s), pois tinham histórico de atendimento, que foi preservado.`);
    }
    if (failures.length > 0) {
      toast.error(`${failures.length} fila(s) não puderam ser excluídas.`, {
        description: failures.join("\n"),
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Filas de atendimento</h2>
          <p className="text-muted-foreground mt-1 text-sm">Gerencie as filas e seus atendentes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar fila..."
            className="w-52"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={isActive}
            onValueChange={(v) => {
              setIsActive(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SITUATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManageQueues && selectedCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  <Trash2 className="size-4" /> Excluir selecionadas ({selectedCount})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir {selectedCount} fila(s)?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Filas sem nenhum ticket são excluídas de verdade. Filas com algum ticket (mesmo já encerrado) são
                    só desabilitadas: somem desta lista, mas o histórico de atendimento é preservado. Esta ação não
                    pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleBulkDelete}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canManageQueues && (
            <QueueFormDialog
              serviceIslandId={islandId}
              members={members ?? []}
              onSaved={() => mutate()}
              trigger={
                <Button>
                  <Plus className="size-4" /> Nova fila
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={ListChecks}
          iconClassName="bg-primary/10 text-primary"
          label="Filas"
          value={stats ? stats.total : "—"}
          sublabel="Cadastradas nesta ilha"
        />
        <MetricCard
          icon={CheckCircle2}
          iconClassName="bg-success/15 text-success"
          label="Ativas"
          value={stats ? stats.active : "—"}
          sublabel="Recebendo atendimentos"
        />
        <MetricCard
          icon={XCircle}
          iconClassName="bg-muted text-muted-foreground"
          label="Inativas"
          value={stats ? stats.inactive : "—"}
          sublabel="Fora de operação"
        />
      </div>

      <Card className="overflow-hidden p-0 shadow-xl">
        <CardHeader>
          <CardTitle>Filas cadastradas</CardTitle>
        </CardHeader>
        {!queues || queues.items.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">
            {!queues ? "Carregando…" : "Nenhuma fila encontrada com os filtros atuais."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {canManageQueues && (
                  <TableHead className="w-10">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                        aria-label="Selecionar todas as filas desta página"
                      />
                    </div>
                  </TableHead>
                )}
                <TableHead className="text-left">Nome da fila</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atendentes</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Carteira</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.items.map((queue) => (
                <TableRow key={queue.id}>
                  {canManageQueues && (
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedIds.has(queue.id)}
                          onCheckedChange={(checked) => toggleSelected(queue.id, checked === true)}
                          aria-label={`Selecionar fila ${queue.name}`}
                        />
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-left font-medium">{queue.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Badge
                        className={
                          queue.isActive ? "bg-primary/10 text-primary border-transparent" : "bg-muted text-muted-foreground border-transparent"
                        }
                      >
                        {queue.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{queue.members?.length ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {queue.businessHoursEnabled ? (
                      <>
                        {queue.businessHoursStart}–{queue.businessHoursEnd} ·{" "}
                        {queue.businessDays.map((d) => DAY_LABELS[d]).join(", ")}
                      </>
                    ) : (
                      "Sem horário restrito"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Switch
                        checked={queue.carteiraEnabled}
                        disabled={!canManageQueues || togglingCarteiraId === queue.id}
                        onCheckedChange={(v) => handleToggleCarteira(queue.id, v)}
                        aria-label={`Liberar fila ${queue.name} para carteira`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => navigate(`/service-island/${islandId}/queue/${queue.id}`)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {queues && queues.total > 0 && (
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={queues.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </Card>
    </div>
  );
}
