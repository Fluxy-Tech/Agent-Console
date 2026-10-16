import { CrmFunnelTab } from "./crm-funnel-tab";
import { CrmPageShell } from "./crm-page-shell";

export function CrmFunnelPage() {
  return (
    <CrmPageShell section="Métricas de funil">
      <CrmFunnelTab />
    </CrmPageShell>
  );
}
