import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import type { AgentMetadataField } from "@/types/domain";
import { MetadataFieldFormDialog } from "./metadata-field-form-dialog";

interface MetadataFieldsCardProps {
  /// undefined no modo criação — metadado precisa de um agente já salvo.
  agentId: string | undefined;
  canWrite: boolean;
}

/// Metadados que o agente coleta do contato. Salva direto na API a cada
/// ação (não depende do botão "Salvar alterações" do agente).
export function MetadataFieldsCard({ agentId, canWrite }: MetadataFieldsCardProps) {
  const { data: fields, mutate } = useSWR<AgentMetadataField[]>(
    agentId ? `/api/agents/${agentId}/metadata-fields` : null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggle(field: AgentMetadataField, active: boolean) {
    setBusyId(field.id);
    try {
      await api.put(`/api/agents/${agentId}/metadata-fields/${field.id}`, {
        name: field.name,
        rule: field.rule,
        active,
      });
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar o metadado.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(field: AgentMetadataField) {
    setBusyId(field.id);
    try {
      await api.delete(`/api/agents/${agentId}/metadata-fields/${field.id}`);
      await mutate();
      toast.success(`Metadado "${field.name}" excluído.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o metadado.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaved() {
    await mutate();
    toast.success("Metadado salvo.");
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Tags className="size-5" />
          </div>
          <div>
            <CardTitle>Metadados</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Defina quais dados o agente deve coletar do contato durante a conversa. Os valores coletados ficam
              salvos nos metadados do contato.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!agentId ? (
          <p className="text-muted-foreground text-sm">Crie o agente primeiro para cadastrar os metadados.</p>
        ) : (
          <>
            {canWrite && (
              <MetadataFieldFormDialog
                agentId={agentId}
                onSaved={handleSaved}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-dashed border-[#25D366]/40 bg-[#25D366]/10 hover:bg-[#25D366]/20"
                  >
                    <Plus className="size-4" /> Adicionar metadado
                  </Button>
                }
              />
            )}

            {!fields || fields.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum metadado cadastrado ainda.</p>
            ) : (
              fields.map((field) => (
                <div
                  key={field.id}
                  className="border-border flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{field.name}</p>
                      <code className="bg-muted text-muted-foreground rounded-sm px-1 py-0.5 font-mono text-xs">
                        {field.nameToAgent}
                      </code>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs whitespace-pre-line">{field.rule}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={field.active}
                      onCheckedChange={(v) => handleToggle(field, v)}
                      disabled={!canWrite || busyId === field.id}
                      aria-label={field.active ? "Desativar coleta" : "Ativar coleta"}
                      className="data-[state=checked]:bg-[#25D366] mr-1"
                    />
                    {canWrite && (
                      <>
                        <MetadataFieldFormDialog
                          agentId={agentId}
                          field={field}
                          onSaved={handleSaved}
                          trigger={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground size-8"
                              aria-label={`Editar ${field.name}`}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive size-8"
                              disabled={busyId === field.id}
                              aria-label={`Excluir ${field.name}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir "{field.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O agente para de coletar esse dado. Os valores já salvos nos contatos continuam lá.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => handleDelete(field)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
