import { Building2, KeyRound, UserRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppSelector } from "@/store/hooks";
import { BusinessDetailPage } from "../business/business-detail-page";
import { CompanySettingsTab } from "./company-settings-tab";
import { ProfileSettingsTab } from "./profile-settings-tab";

/// Configurações: "Meu perfil" para todo mundo; "Empresa" e "Acessos" só para
/// Gerente da empresa ativa ou Administrador (o Agent-Api checa o mesmo).
export function SettingsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const activeCompany = useAppSelector((s) => s.activeCompany);
  const [searchParams, setSearchParams] = useSearchParams();

  const isManager = !!activeCompany && (!!user?.isPlatformAdmin || activeCompany.memberRole === "GERENTE");
  const tabs = isManager ? ["profile", "company", "access"] : ["profile"];
  const requested = searchParams.get("tab");
  const tab = requested && tabs.includes(requested) ? requested : "profile";

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Configurações" }]} />

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isManager ? "Seus dados, os dados da empresa e os acessos da equipe." : "Seus dados de usuário."}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="profile">
            <UserRound /> Meu perfil
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="company">
              <Building2 /> Empresa
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger value="access">
              <KeyRound /> Acessos
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettingsTab />
        </TabsContent>

        {isManager && (
          <TabsContent value="company">
            <CompanySettingsTab companyId={activeCompany.id} />
          </TabsContent>
        )}

        {isManager && (
          <TabsContent value="access">
            <BusinessDetailPage embedded />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
