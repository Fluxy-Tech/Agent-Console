import { CrmCalendarTab } from "./crm-calendar-tab";
import { CrmPageShell } from "./crm-page-shell";

export function CrmCalendarPage() {
  return (
    <CrmPageShell
      section="Calendário"
      title="Calendário"
      description="Agende e acompanhe os eventos dos seus leads nas visões de dia, semana e mês."
    >
      <CrmCalendarTab />
    </CrmPageShell>
  );
}
