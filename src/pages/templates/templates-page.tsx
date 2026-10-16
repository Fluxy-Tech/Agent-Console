import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Copy, FileText, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionAction } from "@/domain/permission-action";
import { useCan } from "@/hooks/use-can";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Channel } from "@/types/domain";
import { TemplateEditorDialog } from "./template-editor-dialog";
import { TemplatePreview } from "./template-preview";
import {
  CATEGORY_LABELS,
  fromMetaTemplate,
  LANGUAGES,
  REJECTION_LABELS,
  STATUS_INFO,
  type MessageTemplate,
  type TemplateButton,
  type TemplateForm,
} from "./template-utils";

type Editor = { initial?: TemplateForm; warnings?: string[]; cloneOf?: string } | null;

function previewButtons(template: MessageTemplate): TemplateButton[] {
  const buttons = template.components.find((c) => c.type === "BUTTONS")?.buttons ?? [];
  return buttons.map((b) =>
    b.type === "URL"
      ? { type: "URL", text: b.text ?? "", url: b.url ?? "", example: "" }
      : b.type === "PHONE_NUMBER"
        ? { type: "PHONE_NUMBER", text: b.text ?? "", phoneNumber: b.phone_number ?? "" }
        : b.type === "COPY_CODE"
          ? { type: "COPY_CODE", example: "" }
          : { type: "QUICK_REPLY", text: b.text ?? b.type },
  );
}

/// Campanhas › Templates: templates de mensagem do WABA da rede social
/// escolhida, lidos direto da Meta. Cria do zero ou clona um existente.
export function TemplatesPage() {
  const can = useCan();
  const canWrite = can(PermissionAction.CAMPAIGNS_WRITE);
  const { data: channels } = useSWR<Channel[]>("/api/channels");
  const [channelId, setChannelId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [removing, setRemoving] = useState<MessageTemplate | null>(null);

  useEffect(() => {
    if (!channelId && channels?.length) setChannelId(channels[0].id);
  }, [channels, channelId]);

  const { data: templates, error, isLoading, mutate } = useSWR<MessageTemplate[]>(
    channelId ? `/api/channels/${channelId}/message-templates` : null,
  );

  const filtered = useMemo(
    () =>
      (templates ?? [])
        .filter((t) => status === "ALL" || t.status === status)
        .filter((t) => !search.trim() || t.name.includes(search.trim().toLowerCase())),
    [templates, status, search],
  );

  function handleClone(template: MessageTemplate) {
    const { form, warnings } = fromMetaTemplate(template, (templates ?? []).map((t) => t.name));
    setEditor({ initial: form, warnings, cloneOf: template.name });
  }

  async function handleRemove(template: MessageTemplate) {
    try {
      await api.delete(`/api/channels/${channelId}/message-templates/${template.id}?name=${encodeURIComponent(template.name)}`);
      toast.success("Template excluído.");
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o template.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Campanhas", to: "/campaigns" }, { label: "Templates" }]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Modelos de mensagem aprovados pela Meta para iniciar conversas e disparar campanhas. Crie um novo ou clone um
            existente para editar e enviar para aprovação.
          </p>
        </div>
        {canWrite && channelId && (
          <Button type="button" size="sm" className="w-fit" onClick={() => setEditor({})}>
            <Plus className="size-4" /> Novo template
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,280px)_minmax(0,200px)_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label>Rede social</Label>
          <Select value={channelId} onValueChange={setChannelId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {channels?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {Object.entries(STATUS_INFO).map(([value, info]) => (
                <SelectItem key={value} value={value}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pelo nome" />
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => mutate()} aria-label="Atualizar status">
          <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {!channels ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : channels.length === 0 ? (
        <p className="text-muted-foreground text-sm">Cadastre uma rede social para gerenciar templates.</p>
      ) : error ? (
        <p className="text-destructive text-sm">{error instanceof ApiError ? error.message : "Não foi possível carregar os templates."}</p>
      ) : !templates ? (
        <p className="text-muted-foreground text-sm">Carregando templates da Meta…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed p-6 text-center text-sm">Nenhum template encontrado.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => {
            const info = STATUS_INFO[t.status] ?? { label: t.status, className: "bg-muted text-muted-foreground" };
            const header = t.components.find((c) => c.type === "HEADER");
            return (
              <Card key={t.id} className="shadow-xl">
                <CardContent className="flex h-full flex-col gap-3 pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <FileText className="text-primary mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{t.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {CATEGORY_LABELS[t.category] ?? t.category} · {LANGUAGES.find((l) => l.value === t.language)?.label ?? t.language}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn("shrink-0 border-0", info.className)}>{info.label}</Badge>
                  </div>
                  {t.status === "REJECTED" && t.rejectedReason && (
                    <p className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
                      Motivo: {REJECTION_LABELS[t.rejectedReason] ?? t.rejectedReason}
                    </p>
                  )}
                  <TemplatePreview
                    headerText={header?.format === "TEXT" ? header.text : undefined}
                    headerExample={header?.example?.header_text?.[0]}
                    mediaHeader={header && header.format !== "TEXT" ? `Cabeçalho: ${header.format?.toLowerCase()}` : undefined}
                    bodyText={t.components.find((c) => c.type === "BODY")?.text ?? ""}
                    bodyExamples={t.components.find((c) => c.type === "BODY")?.example?.body_text?.[0]}
                    footerText={t.components.find((c) => c.type === "FOOTER")?.text}
                    buttons={previewButtons(t)}
                  />
                  {canWrite && (
                    <div className="mt-auto flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => handleClone(t)}>
                        <Copy className="size-4" /> Clonar
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setRemoving(t)} aria-label="Excluir template">
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editor && channelId && (
        <TemplateEditorDialog
          channelId={channelId}
          initial={editor.initial}
          warnings={editor.warnings}
          cloneOf={editor.cloneOf}
          open
          onOpenChange={(o) => !o && setEditor(null)}
          onCreated={() => mutate()}
        />
      )}

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o template "{removing?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              O template é excluído na Meta e não poderá mais ser usado em campanhas. O mesmo nome só poderá ser usado de
              novo depois de 30 dias.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => removing && handleRemove(removing)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
