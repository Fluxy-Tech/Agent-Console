import type { AgentFormTabProps } from "./agent-form-types";
import { FeaturesCard } from "./features/features-card";
import { MetadataFieldsCard } from "./metadata-fields-card";

interface FunctionsTabProps extends AgentFormTabProps {
  agentId: string | undefined;
  canWrite: boolean;
}

/// Aba "Função" do agente: o que ele coleta (Metadados) e as funcionalidades
/// adicionadas (funções, mensagens interativas, catálogo e recursos).
export function FunctionsTab({ form, set, agentId, canWrite }: FunctionsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <MetadataFieldsCard agentId={agentId} canWrite={canWrite} />
      <FeaturesCard agentId={agentId} canWrite={canWrite} form={form} set={set} />
    </div>
  );
}
