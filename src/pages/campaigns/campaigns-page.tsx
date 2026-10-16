import { History, Plus, Settings } from "lucide-react";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/hooks/use-can";
import { PermissionAction } from "@/domain/permission-action";
import { CampaignHistoryTab } from "./campaign-history-tab";
import { CampaignNewTab } from "./campaign-new-tab";
import { CampaignSettingsTab } from "./campaign-settings-tab";

export function CampaignsPage() {
  const can = useCan();
  const canWrite = can(PermissionAction.CAMPAIGNS_WRITE);
  const canConfigure = can(PermissionAction.WABAS_WRITE);

  return (
    <div className="page-shell">
      <PageBreadcrumb items={[{ label: "Campanhas" }]} />

      <div>
        <h1 className="page-title">Campanhas</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Disparos em massa (ou manuais) de templates de WhatsApp, histórico de envios e configurações.
        </p>
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">
            <History /> Histórico de campanhas
          </TabsTrigger>
          {canWrite && (
            <TabsTrigger value="new">
              <Plus /> Nova campanha
            </TabsTrigger>
          )}
          <TabsTrigger value="settings">
            <Settings /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <CampaignHistoryTab />
        </TabsContent>

        {canWrite && (
          <TabsContent value="new">
            <CampaignNewTab />
          </TabsContent>
        )}

        <TabsContent value="settings">
          <CampaignSettingsTab canWrite={canConfigure} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
