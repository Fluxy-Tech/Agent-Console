import { FileText, Plus, Power, Shapes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RagDocumentsDialog, type RagUploadBatch } from "@/components/rag-documents-dialog";
import type { RagDocument } from "@/types/domain";
import type { AgentFormTabProps } from "./agent-form-types";

const RAG_STATUS_BADGE: Record<RagDocument["status"], { label: string; variant: "warning" | "success" | "destructive" }> = {
  PROCESSING: { label: "Processando...", variant: "warning" },
  READY: { label: "Pronto", variant: "success" },
  FAILED: { label: "Falhou", variant: "destructive" },
};

interface RagTabProps extends AgentFormTabProps {
  isNew: boolean;
  uploadingRag: boolean;
  onAttachDocuments: (batch: RagUploadBatch) => void | Promise<void>;
  pendingRagUploads: RagUploadBatch[];
  ragDocuments: RagDocument[] | undefined;
}

export function RagTab({
  form,
  set,
  disabled,
  isNew,
  uploadingRag,
  onAttachDocuments,
  pendingRagUploads,
  ragDocuments,
}: RagTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Power className="size-5" />
            </div>
            <div>
              <CardTitle>Ativação do Rag</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Controle se o agente consulta a base de conhecimento antes de responder ao cliente.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.ragEnabled}
              onCheckedChange={(v) => set("ragEnabled", v)}
              disabled={disabled}
              className="data-[state=checked]:bg-[#25D366]"
            />
            <div>
              <Label className="font-bold">Ativar RAG</Label>
              <p className="text-muted-foreground text-xs">
                O agente consulta os documentos anexados abaixo pra responder com base neles.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {form.ragEnabled && (
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Shapes className="size-5" />
              </div>
              <div>
                <CardTitle>Base de conhecimento</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  Anexe os documentos que o agente vai consultar para responder ao cliente com base neles.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="font-bold">Anexar documentos</Label>
              <p className="text-muted-foreground text-xs">
                O conteúdo é quebrado em pedaços (chunks) e indexado pra o agente consultar nas respostas.
              </p>
            </div>
            <RagDocumentsDialog
              defaultChunkSize={form.ragChunkSize}
              submitting={uploadingRag}
              onSubmit={onAttachDocuments}
              trigger={
                <Button
                  type="button"
                  variant="dashed"
                  disabled={disabled}
                  className="w-full gap-2"
                >
                  <Plus className="size-4" /> Anexar documentos
                </Button>
              }
            />

            {isNew && pendingRagUploads.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-muted-foreground text-xs">Serão enviados assim que o agente for criado:</p>
                {pendingRagUploads.map((batch, index) => (
                  <div key={index} className="border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <FileText className="text-muted-foreground size-4 shrink-0" />
                    <span className="truncate">{batch.files.map((f) => f.name).join(", ")}</span>
                  </div>
                ))}
              </div>
            )}

            {!isNew && (
              <div className="flex flex-col gap-1.5">
                {!ragDocuments || ragDocuments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum documento anexado ainda.</p>
                ) : (
                  ragDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="border-border flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="text-muted-foreground size-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{doc.fileName}</p>
                          {doc.categories.length > 0 && (
                            <p className="text-muted-foreground truncate text-xs">{doc.categories.join(", ")}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={RAG_STATUS_BADGE[doc.status].variant}>{RAG_STATUS_BADGE[doc.status].label}</Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
