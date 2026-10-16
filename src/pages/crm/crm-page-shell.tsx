import type { ReactNode } from "react";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";

/// Moldura comum das telas do CRM (Calendário, Métricas de funil,
/// Configuração): breadcrumb + título. Sem `title`, a própria tela desenha o
/// cabeçalho (quando ele tem ações, ex.: "Nova etapa" no funil).
export function CrmPageShell({
  section,
  title,
  description,
  children,
}: {
  section: string;
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="page-shell">
      <PageBreadcrumb items={[{ label: "CRM", to: "/crm" }, { label: section }]} />
      {title && (
        <div>
          <h1 className="page-title">{title}</h1>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
