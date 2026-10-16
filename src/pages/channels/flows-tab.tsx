import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Ban, ExternalLink, Eye, Pencil, Plus, RefreshCw, Rocket, Trash2, Workflow } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FLOW_CATEGORY_LABELS, FlowEditorDialog, FLOWS_PLAYGROUND_URL, type WhatsappFlow } from "./flow-editor-dialog";

const STATUS_INFO: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  PUBLISHED: { label: "Publicado", className: "bg-success/15 text-success" },
  DEPRECATED: { label: "Descontinuado", className: "bg-muted text-muted-foreground" },
  BLOCKED: { label: "Bloqueado", className: "bg-destructive/15 text-destructive" },
  THROTTLED: { label: "Limitado", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
};

type Confirm = { kind: "publish" | "deprecate" | "delete"; flow: WhatsappFlow } | null;

const CONFIRM_TEXT = {
  publish: {
    title: "Publicar o flow",
    description: "Depois de publicado, o flow pode ser enviado aos contatos, mas não pode mais ser editado nem excluído.",
    action: "Publicar",
  },
  deprecate: {
    title: "Descontinuar o flow",
    description: "O flow deixa de poder ser enviado e aberto pelos contatos. Esta ação não pode ser desfeita.",
    action: "Descontinuar",
  },
  delete: {
    title: "Excluir o rascunho",
    description: "O flow é excluído na Meta. Esta ação não pode ser desfeita.",
    action: "Excluir",
  },
};

/// Redes sociais › aba Flows: WhatsApp Flows do WABA desta rede social, lidos
/// e gerenciados direto na Meta.
export function FlowsTab({ channelId, canWrite }: { channelId: string; canWrite: boolean }) {
  const { data: flows, error, isLoading, mutate } = useSWR<WhatsappFlow[]>(`/api/channels/${channelId}/flows`);
  const [editor, setEditor] = useState<{ flow?: WhatsappFlow; json?: string | null } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadDetail(flow: WhatsappFlow) {
    setBusyId(flow.id);
    try {
      return await api.get<WhatsappFlow & { flowJson: string | null; preview?: { preview_url?: string } }>(
        `/api/channels/${channelId}/flows/${flow.id}`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível carregar o flow.");
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function handleEdit(flow: WhatsappFlow) {
    const detail = await loadDetail(flow);
    if (detail) setEditor({ flow: detail, json: detail.flowJson });
  }

  async function handlePreview(flow: WhatsappFlow) {
    // Abre a aba antes do await: navegadores bloqueiam window.open depois.
    const tab = window.open("", "_blank");
    const detail = await loadDetail(flow);
    const url = detail?.preview?.preview_url;
    if (url && tab) tab.location.href = url;
    else {
      tab?.close();
      if (detail) toast.error("A Meta não gerou a pré-visualização deste flow.");
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    const { kind, flow } = confirm;
    setBusyId(flow.id);
    try {
      if (kind === "delete") await api.delete(`/api/channels/${channelId}/flows/${flow.id}`);
      else await api.post(`/api/channels/${channelId}/flows/${flow.id}/${kind}`, {});
      toast.success(kind === "publish" ? "Flow publicado." : kind === "deprecate" ? "Flow descontinuado." : "Flow excluído.");
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível concluir a ação.");
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex flex-1 items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Workflow className="size-5" />
            </div>
            <div>
              <CardTitle>Flows</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Formulários interativos abertos dentro do WhatsApp, como cadastros, agendamentos e pesquisas. Os flows
                ficam salvos na conta do WhatsApp desta rede social, na Meta.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={FLOWS_PLAYGROUND_URL} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ExternalLink className="size-4" /> Playground da Meta
            </a>
            <Button type="button" variant="outline" size="icon" onClick={() => mutate()} aria-label="Atualizar">
              <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
            </Button>
            {canWrite && (
              <Button type="button" size="sm" onClick={() => setEditor({})}>
                <Plus className="size-4" /> Novo flow
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? (
          <p className="text-destructive text-sm">{error instanceof ApiError ? error.message : "Não foi possível carregar os flows."}</p>
        ) : !flows ? (
          <p className="text-muted-foreground text-sm">Carregando flows da Meta…</p>
        ) : flows.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed p-6 text-center text-sm">
            Nenhum flow criado nesta rede social.
          </p>
        ) : (
          flows.map((flow) => {
            const info = STATUS_INFO[flow.status] ?? { label: flow.status, className: "bg-muted text-muted-foreground" };
            const busy = busyId === flow.id;
            const isDraft = flow.status === "DRAFT";
            return (
              <div key={flow.id} className="border-border flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{flow.name}</p>
                    <Badge className={cn("border-0", info.className)}>{info.label}</Badge>
                    {flow.validation_errors.length > 0 && (
                      <Badge className="bg-destructive/15 text-destructive border-0">{flow.validation_errors.length} erro(s)</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {flow.categories.map((c) => (
                      <Badge key={c} variant="secondary">
                        {FLOW_CATEGORY_LABELS[c] ?? c}
                      </Badge>
                    ))}
                    {flow.updated_at && (
                      <span className="text-muted-foreground text-xs">Atualizado em {new Date(flow.updated_at).toLocaleString("pt-BR")}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => handlePreview(flow)}>
                    <Eye className="size-4" /> Pré-visualizar
                  </Button>
                  {canWrite && isDraft && (
                    <>
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => handleEdit(flow)}>
                        <Pencil className="size-4" /> Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || flow.validation_errors.length > 0}
                        title={flow.validation_errors.length > 0 ? "Corrija os erros antes de publicar." : undefined}
                        onClick={() => setConfirm({ kind: "publish", flow })}
                      >
                        <Rocket className="size-4" /> Publicar
                      </Button>
                      <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={() => setConfirm({ kind: "delete", flow })} aria-label="Excluir">
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </>
                  )}
                  {canWrite && flow.status === "PUBLISHED" && (
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setConfirm({ kind: "deprecate", flow })}>
                      <Ban className="size-4" /> Descontinuar
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {editor && (
        <FlowEditorDialog
          channelId={channelId}
          flow={editor.flow}
          initialJson={editor.json}
          open
          onOpenChange={(o) => !o && setEditor(null)}
          onSaved={() => mutate()}
        />
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm && CONFIRM_TEXT[confirm.kind].title} "{confirm?.flow.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>{confirm && CONFIRM_TEXT[confirm.kind].description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant={confirm?.kind === "publish" ? "default" : "destructive"} onClick={handleConfirm}>
              {confirm && CONFIRM_TEXT[confirm.kind].action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
