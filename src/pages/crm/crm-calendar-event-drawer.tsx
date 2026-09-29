import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { Check, ExternalLink, FileText, Loader2, Lock, Paperclip, Pencil, Send, Trash2, X } from "lucide-react";
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
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PermissionAction } from "@/domain/permission-action";
import { useCan } from "@/hooks/use-can";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type { CalendarEventAnnotation, CalendarEventDetail, EventStatus } from "@/types/domain";
import {
  CALENDAR_STATUS_DOT_CLASSES,
  CALENDAR_STATUS_LABELS,
  CALENDAR_STATUS_OPTIONS,
  type CalendarStatusKey,
  statusKey,
} from "./calendar-event-status";
import { CrmCalendarEventFormDrawer } from "./crm-calendar-event-form-drawer";

interface CrmCalendarEventDrawerProps {
  eventId: string | null;
  onOpenChange: (open: boolean) => void;
  /// Revalida a grade do calendário depois de qualquer alteração.
  onChanged: () => void;
}

/// createdAt (banco) e updatedAt (Prisma Client) saem com alguns ms de
/// diferença na criação — só conta como edição acima de 1s.
function wasEdited(annotation: CalendarEventAnnotation): boolean {
  return new Date(annotation.updatedAt).getTime() - new Date(annotation.createdAt).getTime() > 1000;
}

/// Drawer lateral aberto ao clicar num evento da grade: dados, status/encerramento,
/// documentos (S3) e anotações.
export function CrmCalendarEventDrawer({ eventId, onOpenChange, onChanged }: CrmCalendarEventDrawerProps) {
  const { data: event, mutate } = useSWR<CalendarEventDetail>(eventId ? `/api/crm/calendar/events/${eventId}` : null);
  const can = useCan();
  const canWrite = can(PermissionAction.CRM_WRITE);
  const currentUserId = useAppSelector((s) => s.auth.user?.id);

  const [editOpen, setEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [annotation, setAnnotation] = useState("");
  const [sendingAnnotation, setSendingAnnotation] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [busyAnnotationId, setBusyAnnotationId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    await mutate();
    onChanged();
  }

  async function patchEvent(body: { status?: EventStatus | null; isClosed?: boolean }, success: string) {
    if (!event) return;
    setUpdating(true);
    try {
      await api.patch(`/api/crm/calendar/events/${event.id}`, body);
      toast.success(success);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar o evento.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    try {
      await api.delete(`/api/crm/calendar/events/${event.id}`);
      toast.success("Evento excluído.");
      onOpenChange(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o evento.");
    }
  }

  /// URL presignada → PUT direto no S3 → confirma no Agent-Api (mesmo fluxo
  /// dos anexos do card do Kanban).
  async function handleFilesSelected(files: FileList | null) {
    if (!event || !files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const contentType = file.type || "application/octet-stream";
        const { uploadUrl, s3Key } = await api.post<{ uploadUrl: string; s3Key: string }>(
          `/api/crm/calendar/events/${event.id}/documents/presign`,
          { fileName: file.name, contentType },
        );
        const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
        if (!response.ok) throw new Error(`Falha ao enviar ${file.name}.`);
        await api.post(`/api/crm/calendar/events/${event.id}/documents`, { s3Key });
      }
      toast.success(files.length > 1 ? "Documentos anexados." : "Documento anexado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível anexar o documento.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await mutate();
    }
  }

  async function handleRemoveDocument(s3Key: string) {
    if (!event) return;
    setRemovingKey(s3Key);
    try {
      await api.delete(`/api/crm/calendar/events/${event.id}/documents?s3Key=${encodeURIComponent(s3Key)}`);
      toast.success("Documento removido do evento.");
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível remover o documento.");
    } finally {
      setRemovingKey(null);
    }
  }

  async function handleSendAnnotation() {
    if (!event || annotation.trim().length === 0) return;
    setSendingAnnotation(true);
    try {
      await api.post(`/api/crm/calendar/events/${event.id}/annotations`, { message: annotation });
      setAnnotation("");
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar a anotação.");
    } finally {
      setSendingAnnotation(false);
    }
  }

  async function handleUpdateAnnotation(annotationId: string) {
    if (!event || editingText.trim().length === 0) return;
    setBusyAnnotationId(annotationId);
    try {
      await api.patch(`/api/crm/calendar/events/${event.id}/annotations/${annotationId}`, { message: editingText });
      setEditingAnnotationId(null);
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível editar a anotação.");
    } finally {
      setBusyAnnotationId(null);
    }
  }

  async function handleDeleteAnnotation(annotationId: string) {
    if (!event) return;
    setBusyAnnotationId(annotationId);
    try {
      await api.delete(`/api/crm/calendar/events/${event.id}/annotations/${annotationId}`);
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível apagar a anotação.");
    } finally {
      setBusyAnnotationId(null);
    }
  }

  const currentStatus = event ? statusKey(event.status) : "SCHEDULED";

  return (
    <>
      <Drawer direction="right" open={eventId !== null} onOpenChange={onOpenChange}>
        <DrawerContent className="overflow-y-auto sm:max-w-lg">
          {!event ? (
            <>
              <DrawerTitle className="sr-only">Evento</DrawerTitle>
              <p className="text-muted-foreground p-6 text-sm">Carregando…</p>
            </>
          ) : (
            <>
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2 text-lg">
                  {event.isClosed && <Lock className="text-muted-foreground size-4 shrink-0" />}
                  <span className="truncate">{event.name}</span>
                </DrawerTitle>
                <DrawerDescription>
                  {new Date(event.dateEvent).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
                  {event.user && <> · Responsável: {event.user.name}</>}
                </DrawerDescription>
              </DrawerHeader>

              <div className="flex flex-col gap-4 p-4 pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    to={`/targets/${event.target.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
                  >
                    <ExternalLink className="size-4" />
                    {event.target.name || event.target.waId || "Contato sem nome"}
                    {event.target.name && event.target.waId && (
                      <span className="text-muted-foreground">· {event.target.waId}</span>
                    )}
                  </Link>
                  {canWrite && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={event.isClosed}
                        title={event.isClosed ? "Reabra o evento para editar" : undefined}
                        onClick={() => setEditOpen(true)}
                      >
                        <Pencil className="size-4" /> Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="destructive" size="sm">
                            <Trash2 className="size-4" /> Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir evento "{event.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              As anotações do evento são apagadas junto. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                {event.description && <p className="text-sm whitespace-pre-wrap">{event.description}</p>}

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Status</Label>
                    <Select
                      value={currentStatus}
                      disabled={!canWrite || updating}
                      onValueChange={(value) => {
                        const key = value as CalendarStatusKey;
                        void patchEvent(
                          { status: key === "SCHEDULED" ? null : key },
                          `Status: ${CALENDAR_STATUS_LABELS[key]}.`,
                        );
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALENDAR_STATUS_OPTIONS.map((key) => (
                          <SelectItem key={key} value={key}>
                            <span className={cn("size-2 rounded-full", CALENDAR_STATUS_DOT_CLASSES[key])} />
                            {CALENDAR_STATUS_LABELS[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                    <div>
                      <Label>Evento encerrado</Label>
                      <p className="text-muted-foreground text-xs">Trava nome, data, descrição e contato.</p>
                    </div>
                    <Switch
                      checked={event.isClosed}
                      disabled={!canWrite || updating}
                      onCheckedChange={(value) =>
                        void patchEvent({ isClosed: value }, value ? "Evento encerrado." : "Evento reaberto.")
                      }
                    />
                  </div>
                </div>

                <Separator />

                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Documentos</h3>
                    {canWrite && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => void handleFilesSelected(e.target.files)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                          {uploading ? "Enviando…" : "Anexar documento"}
                        </Button>
                      </>
                    )}
                  </div>
                  {event.documents.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum documento anexado.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {event.documents.map((document) => (
                        <li key={document.s3Key} className="flex items-center gap-1.5">
                          <a
                            href={document.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:bg-accent flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm"
                          >
                            <FileText className="text-muted-foreground size-4 shrink-0" />
                            <span className="truncate">{document.fileName}</span>
                          </a>
                          {canWrite && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9 shrink-0"
                              disabled={removingKey === document.s3Key}
                              onClick={() => void handleRemoveDocument(document.s3Key)}
                              aria-label={`Remover ${document.fileName} do evento`}
                            >
                              <Trash2 className="text-destructive size-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <Separator />

                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold">Anotações</h3>
                  <div className="flex flex-col gap-2">
                    <Textarea
                      value={annotation}
                      onChange={(e) => setAnnotation(e.target.value)}
                      placeholder="Escreva uma anotação…"
                      maxLength={2000}
                      className="min-h-20"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="self-end"
                      disabled={sendingAnnotation || annotation.trim().length === 0}
                      onClick={() => void handleSendAnnotation()}
                    >
                      {sendingAnnotation ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      Anotar
                    </Button>
                  </div>

                  {event.annotations.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhuma anotação ainda.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {event.annotations.map((item) => {
                        const isOwner = item.user.id === currentUserId;
                        const isEditing = editingAnnotationId === item.id;
                        const busy = busyAnnotationId === item.id;

                        return (
                          <li key={item.id} className="bg-muted/40 flex flex-col gap-1 rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium">{item.user.name}</span>
                              <div className="flex items-center gap-0.5">
                                <span className="text-muted-foreground mr-1">
                                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                                  {wasEdited(item) && (
                                    <span
                                      className="ml-1 italic"
                                      title={`Editado em ${new Date(item.updatedAt).toLocaleString("pt-BR")}`}
                                    >
                                      (editado)
                                    </span>
                                  )}
                                </span>
                                {isOwner && !isEditing && (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-7"
                                      disabled={busy}
                                      onClick={() => {
                                        setEditingAnnotationId(item.id);
                                        setEditingText(item.message);
                                      }}
                                      aria-label="Editar anotação"
                                    >
                                      <Pencil className="size-3.5" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="size-7"
                                          disabled={busy}
                                          aria-label="Apagar anotação"
                                        >
                                          <Trash2 className="text-destructive size-3.5" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Apagar anotação?</AlertDialogTitle>
                                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            variant="destructive"
                                            onClick={() => void handleDeleteAnnotation(item.id)}
                                          >
                                            Apagar
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                              </div>
                            </div>
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <Textarea
                                  autoFocus
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  maxLength={2000}
                                  className="bg-background min-h-20"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingAnnotationId(null)}
                                  >
                                    <X className="size-4" /> Cancelar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={busy || editingText.trim().length === 0}
                                    onClick={() => void handleUpdateAnnotation(item.id)}
                                  >
                                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                                    Salvar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <CrmCalendarEventFormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        event={event}
        onSaved={() => void refresh()}
      />
    </>
  );
}
