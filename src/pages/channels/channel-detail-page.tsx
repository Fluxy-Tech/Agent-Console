import { useParams } from "react-router-dom";
import useSWR from "swr";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/hooks/use-can";
import { PermissionAction } from "@/domain/permission-action";
import type { Channel } from "@/types/domain";
import { ConfigTab } from "./config-tab";
import { DashboardTab } from "./dashboard-tab";
import { FlowsTab } from "./flows-tab";

export function ChannelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const canWrite = can(PermissionAction.WABAS_WRITE);

  const { data: channel, mutate } = useSWR<Channel>(id ? `/api/channels/${id}` : null);

  if (!channel) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="page-shell">
      <PageBreadcrumb items={[{ label: "Redes sociais", to: "/channels" }, { label: channel.displayNumber }]} />

      <div>
        <h1 className="page-title">{channel.displayNumber}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Configurações e métricas desta rede social.</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="flows">Flows</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab channelId={channel.id} hasMetaAccessToken={channel.metaAccessTokenPreview !== null} />
        </TabsContent>

        <TabsContent value="config">
          <ConfigTab channel={channel} canWrite={canWrite} onSaved={() => mutate()} />
        </TabsContent>

        <TabsContent value="flows">
          <FlowsTab channelId={channel.id} canWrite={canWrite} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
