import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { Coins, Database, MessageCircleMore, Save, User } from "lucide-react";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RagUploadBatch } from "@/components/rag-documents-dialog";
import { useCan } from "@/hooks/use-can";
import { PermissionAction } from "@/domain/permission-action";
import { api, ApiError } from "@/lib/api";
import type { Agent, RagDocument, SeriesPeriod, TokenUsage } from "@/types/domain";
import type { FormState } from "./agent-form-types";
import { IdentityTab } from "./identity-tab";
import { MessagesTab } from "./messages-tab";
import { RagTab } from "./rag-tab";
import { TokenUsageOverview } from "./token-usage-overview";

async function uploadRagBatch(agentId: string, batch: RagUploadBatch): Promise<void> {
  for (const file of batch.files) {
    const { uploadUrl, s3Key } = await api.post<{ uploadUrl: string; s3Key: string }>(
      `/api/agents/${agentId}/rag/presign`,
      { fileName: file.name, contentType: file.type },
    );
    await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    await api.post(`/api/agents/${agentId}/rag/documents`, {
      fileName: file.name,
      s3Key,
      categories: batch.categories,
      chunkSize: batch.chunkSize,
    });
  }
}

const EMPTY_FORM: FormState = {
  name: "Assistente Virtual",
  isActive: true,
  processingMessage:
    "Só um momento, por favor. Estou analisando cuidadosamente sua mensagem para te dar a resposta mais completa e precisa possível. Já retorno com as informações!",
  transferMessage:
    "Entendido! Para garantir que você receba o melhor atendimento, vou transferir esta conversa para um de nossos atendentes, que dará continuidade a partir daqui. Por favor, aguarde só mais um instante — em breve alguém da nossa equipe vai falar com você.",
  unsupportedFormatMessage:
    "Desculpe, ainda não consigo processar esse tipo de arquivo ou mídia que você enviou. Para que eu possa te ajudar da melhor forma, poderia, por gentileza, reenviar sua solicitação em texto?",
  blockedMessage:
    "No momento não conseguimos continuar o atendimento por este canal. Se precisar de suporte, entre em contato por outro meio.",
  outOfHoursMessage:
    "Agradecemos o seu contato! No momento estamos fora do nosso horário de atendimento humano, mas já registramos sua mensagem. Assim que nossa equipe retornar, um de nossos atendentes vai falar com você o quanto antes.",
  outOfHoursEnabled: true,
  closingMessage:
    "Foi um prazer poder te ajudar hoje! Se surgir alguma nova dúvida ou precisar de suporte novamente, é só me chamar por aqui a qualquer momento. Agradecemos o contato e desejamos um ótimo dia! 👋",
  closingEnabled: true,
  errorMessage:
    "Peço desculpas, mas encontrei um problema inesperado ao tentar processar sua solicitação. Poderia tentar novamente, por favor? Caso o problema persista, um de nossos atendentes poderá te ajudar diretamente.",
  errorEnabled: true,
  personality: "Comunique-se de forma cordial, clara e objetiva, como um atendente profissional e prestativo.",
  ragEnabled: false,
  ragChunkSize: 500,
};

function toForm(agent: Agent): FormState {
  return {
    name: agent.name,
    isActive: agent.isActive,
    processingMessage: agent.processingMessage,
    transferMessage: agent.transferMessage,
    unsupportedFormatMessage: agent.unsupportedFormatMessage,
    blockedMessage: agent.blockedMessage,
    outOfHoursMessage: agent.outOfHoursMessage,
    outOfHoursEnabled: agent.outOfHoursEnabled,
    closingMessage: agent.closingMessage,
    closingEnabled: agent.closingEnabled,
    errorMessage: agent.errorMessage,
    errorEnabled: agent.errorEnabled,
    personality: agent.personality ?? "",
    ragEnabled: agent.ragEnabled,
    ragChunkSize: agent.ragChunkSize ?? 500,
  };
}

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useCan();
  // A rota /agents/new não tem segmento :id (é estática, só /agents/:id tem),
  // então `id` vem undefined nela — não "new" literal.
  const isNew = !id;

  const { data: agent } = useSWR<Agent>(!isNew && id ? `/api/agents/${id}` : null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tokens de IA nunca vêm preenchidos do backend (só a prévia de 6 chars,
  // em agent.openaiTokenPreview/geminiTokenPreview) — campo em branco aqui =
  // não mexe no token já salvo, mesmo padrão do metaAccessToken do WhatsApp
  // Channel.
  const [openaiToken, setOpenaiToken] = useState("");
  const [geminiToken, setGeminiToken] = useState("");

  // Modo criação: ainda não existe agentId pra vincular um RagDocument, então
  // os lotes ficam "preparados" aqui e só são enviados de verdade depois que
  // o agente é criado (ver handleSubmit).
  const [pendingRagUploads, setPendingRagUploads] = useState<RagUploadBatch[]>([]);
  const [uploadingRag, setUploadingRag] = useState(false);

  const { data: ragDocuments, mutate: mutateRagDocuments } = useSWR<RagDocument[]>(
    !isNew && id ? `/api/agents/${id}/rag/documents` : null,
    { refreshInterval: (data) => (data?.some((d) => d.status === "PROCESSING") ? 3000 : 0) },
  );

  const [tokenPeriod, setTokenPeriod] = useState<SeriesPeriod>("current-month");
  const { data: tokenUsage } = useSWR<TokenUsage>(
    !isNew && id ? `/api/agents/${id}/token-usage?period=${tokenPeriod}` : null,
  );

  useEffect(() => {
    if (agent) setForm(toForm(agent));
  }, [agent]);

  const canWrite = can(PermissionAction.AGENTS_WRITE);
  const disabled = !canWrite || saving;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAttachDocuments(batch: RagUploadBatch) {
    set("ragChunkSize", batch.chunkSize);

    if (isNew) {
      setPendingRagUploads((prev) => [...prev, batch]);
      toast.success(`${batch.files.length} arquivo(s) preparado(s) — serão enviados ao criar o agente.`);
      return;
    }

    setUploadingRag(true);
    try {
      await uploadRagBatch(id!, batch);
      await mutateRagDocuments();
      toast.success("Documentos anexados — processando em segundo plano.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível anexar os documentos.");
    } finally {
      setUploadingRag(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const tokenOverrides = {
        ...(openaiToken ? { openaiToken } : {}),
        ...(geminiToken ? { geminiToken } : {}),
      };

      if (isNew) {
        const created = await api.post<Agent>("/api/agents", { ...form, ...tokenOverrides });

        for (const batch of pendingRagUploads) {
          try {
            await uploadRagBatch(created.id, batch);
          } catch {
            toast.error(`Não foi possível anexar ${batch.files.map((f) => f.name).join(", ")}.`);
          }
        }

        toast.success("Agente criado.");
        navigate(`/agents/${created.id}`, { replace: true });
      } else {
        await api.put<Agent>(`/api/agents/${id}`, { ...form, ...tokenOverrides });
        toast.success("Agente atualizado.");
      }
      setOpenaiToken("");
      setGeminiToken("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o agente.");
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && !agent) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
      <PageBreadcrumb
        items={[{ label: "Agentes", to: "/agents" }, { label: isNew ? "Novo agente" : form.name || "Agente" }]}
      />

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {isNew ? "Novo agente" : form.name || "Agente"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure a identidade, as mensagens automáticas e a base de conhecimento deste agente.
        </p>
      </div>

      <Tabs defaultValue="identity">
        <TabsList>
          <TabsTrigger value="identity">
            <User /> Identidade
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageCircleMore /> Mensagens fixas
          </TabsTrigger>
          <TabsTrigger value="rag">
            <Database /> RAG
          </TabsTrigger>
          {!isNew && (
            <TabsTrigger value="tokens">
              <Coins /> Consumo
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="identity">
          <IdentityTab
            form={form}
            set={set}
            disabled={disabled}
            agentId={id}
            canWrite={canWrite}
            openaiToken={openaiToken}
            onChangeOpenaiToken={setOpenaiToken}
            openaiTokenPreview={agent?.openaiTokenPreview ?? null}
            geminiToken={geminiToken}
            onChangeGeminiToken={setGeminiToken}
            geminiTokenPreview={agent?.geminiTokenPreview ?? null}
          />
        </TabsContent>

        <TabsContent value="messages">
          <MessagesTab form={form} set={set} disabled={disabled} />
        </TabsContent>

        <TabsContent value="rag">
          <RagTab
            form={form}
            set={set}
            disabled={disabled}
            isNew={isNew}
            uploadingRag={uploadingRag}
            onAttachDocuments={handleAttachDocuments}
            pendingRagUploads={pendingRagUploads}
            ragDocuments={ragDocuments}
          />
        </TabsContent>

        {!isNew && (
          <TabsContent value="tokens">
            <TokenUsageOverview
              data={tokenUsage}
              period={tokenPeriod}
              onPeriodChange={setTokenPeriod}
              totalLabel="Consumo do agente"
              chartTitle="Consumo de tokens deste agente"
              chartDescription="Tokens gastos pelo agente no período, separados por LLM: ADK (geração das respostas via Gemini) e OpenAI (escolha de fila, resumos, mensagens de erro e embeddings do RAG)."
            />
          </TabsContent>
        )}
      </Tabs>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {canWrite && (
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando…" : isNew ? "Criar agente" : "Salvar alterações"}
          </Button>
        </div>
      )}
    </form>
  );
}
