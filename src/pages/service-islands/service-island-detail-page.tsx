import { useParams } from "react-router-dom";
import useSWR from "swr";
import { Activity, History, ListChecks, Settings } from "lucide-react";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/hooks/use-can";
import { PermissionAction } from "@/domain/permission-action";
import type { ServiceIsland } from "@/types/domain";
import { GeneralSettingsTab } from "./general-settings-tab";
import { HistoryTab } from "./history-tab";
import { MonitoringTab } from "./monitoring-tab";
import { QueuesTab } from "./queues-tab";

export function ServiceIslandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();

  const { data: island, mutate } = useSWR<ServiceIsland>(id ? `/api/service-islands/${id}` : null);

  const canRenameIsland = can(PermissionAction.SERVICE_ISLANDS_WRITE);
  const canManageQueues = can(PermissionAction.QUEUES_WRITE);
  const canManageTags = can(PermissionAction.QUEUES_WRITE);

  if (!island) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="page-shell">
      <PageBreadcrumb items={[{ label: "Ilhas de Atendimento", to: "/service-island" }, { label: island.name }]} />

      <div>
        <h1 className="page-title">{island.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Monitore o atendimento, acompanhe o histórico, gerencie as filas e configure as regras desta ilha de
          atendimento.
        </p>
      </div>

      <Tabs defaultValue="monitoring">
        <TabsList>
          <TabsTrigger value="monitoring">
            <Activity /> Monitoramento
          </TabsTrigger>
          <TabsTrigger value="history">
            <History /> Histórico
          </TabsTrigger>
          <TabsTrigger value="queues">
            <ListChecks /> Filas
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings /> Configurações Gerais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring">
          <MonitoringTab islandId={island.id} />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab island={island} />
        </TabsContent>

        <TabsContent value="queues">
          <QueuesTab islandId={island.id} canManageQueues={canManageQueues} />
        </TabsContent>

        <TabsContent value="settings">
          <GeneralSettingsTab
            island={island}
            canWrite={canRenameIsland}
            canManageTags={canManageTags}
            onSaved={() => mutate()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
