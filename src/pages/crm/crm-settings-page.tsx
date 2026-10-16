import { CrmPageShell } from "./crm-page-shell";
import { CrmSettingsTab } from "./crm-settings-tab";

export function CrmSettingsPage() {
  return (
    <CrmPageShell
      section="Configuração"
      title="Configuração"
      description="Defina quem pode ser inserido nos cards do CRM e os limites de cada usuário."
    >
      <CrmSettingsTab />
    </CrmPageShell>
  );
}
