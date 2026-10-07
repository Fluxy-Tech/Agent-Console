import { useState } from "react";
import useSWR from "swr";
import { Send } from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationControls } from "@/components/pagination-controls";
import { SortableTh } from "@/components/sortable-th";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { IslandMonitoring } from "@/types/domain";

const MONITORING_REFRESH_MS = 8000;

type QueueSortField = "waitingCount" | "inProgressCount";

/// Contagem de aguardando/em-atendimento por fila, atualizada a cada
/// MONITORING_REFRESH_MS — vive na aba Filas, antes da listagem cadastral,
/// pra dar o pulso em tempo real de cada fila logo de cara.
export function RealtimeQueuesCard({ islandId }: { islandId: string }) {
  const { data } = useSWR<IslandMonitoring>(`/api/service-islands/${islandId}/monitoring`, {
    refreshInterval: MONITORING_REFRESH_MS,
  });
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(10);
  const [queueSort, setQueueSort] = useState<{ field: QueueSortField; dir: "asc" | "desc" } | null>(null);

  function toggleQueueSort(field: QueueSortField) {
    setQueueSort((prev) => (prev?.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" }));
    setQueuePage(1);
  }

  if (!data) return null;

  const sortedQueues = queueSort
    ? [...data.queues].sort((a, b) =>
        queueSort.dir === "asc" ? a[queueSort.field] - b[queueSort.field] : b[queueSort.field] - a[queueSort.field],
      )
    : data.queues;

  // Lista já vem inteira da API (1 fetch só) — a paginação aqui é só de
  // exibição (slice no client), por isso a página é sempre "grampeada" no
  // total atual em vez de resetada por efeito.
  const queueTotalPages = Math.max(1, Math.ceil(sortedQueues.length / queuePageSize));
  const queuePageClamped = Math.min(queuePage, queueTotalPages);
  const pagedQueues = sortedQueues.slice((queuePageClamped - 1) * queuePageSize, queuePageClamped * queuePageSize);

  return (
    <>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <div>
            <CardTitle className="text-base">Atendimentos em tempo real</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              Quantidade de tickets aguardando e em atendimento por fila desta ilha, atualizada automaticamente.
            </p>
          </div>
        </div>
        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
          <span className="bg-success size-1.5 rounded-sm" /> Atualizado agora
        </span>
      </CardHeader>
      <CardContent>
        {data.queues.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma fila cadastrada.</p>
        ) : (
          <div className="border-border overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Fila</TableHead>
                  <TableHead>
                    <SortableTh
                      label="Aguardando"
                      active={queueSort?.field === "waitingCount"}
                      dir={queueSort?.field === "waitingCount" ? queueSort.dir : "desc"}
                      onClick={() => toggleQueueSort("waitingCount")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableTh
                      label="Em atendimento"
                      active={queueSort?.field === "inProgressCount"}
                      dir={queueSort?.field === "inProgressCount" ? queueSort.dir : "desc"}
                      onClick={() => toggleQueueSort("inProgressCount")}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedQueues.map((q) => (
                  <TableRow key={q.queueId}>
                    <TableCell className="text-left">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-md">
                          <Send className="size-3.5" />
                        </div>
                        <span className="truncate font-medium">{q.queueName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{q.waitingCount}</TableCell>
                    <TableCell className="text-muted-foreground">{q.inProgressCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls
              page={queuePageClamped}
              pageSize={queuePageSize}
              total={data.queues.length}
              onPageChange={setQueuePage}
              onPageSizeChange={(size) => {
                setQueuePageSize(size);
                setQueuePage(1);
              }}
            />
          </div>
        )}
      </CardContent>
    </>
  );
}
