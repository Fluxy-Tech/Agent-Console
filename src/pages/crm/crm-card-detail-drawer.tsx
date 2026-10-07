import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  Calendar,
  Check,
  ExternalLink,
  FileText,
  IdCard,
  Loader2,
  Mail,
  Paperclip,
  Pencil,
  Phone,
  Send,
  Trash2,
  X,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { MetadataEditor } from "@/components/metadata-editor";
import { PermissionAction } from "@/domain/permission-action";
import { useCan } from "@/hooks/use-can";
import { api, ApiError } from "@/lib/api";
import { formatDateAtTime } from "@/lib/format-date";
import { useAppSelector } from "@/store/hooks";
import { CARD_PRIORITY_LABELS, type CardPriority, type CrmCardComment, type CrmCardDetail } from "@/types/domain";
import { CARD_PRIORITIES } from "./card-priority";

const STATUS_LABELS: Record<string, string> = { AI: "IA", HUMAN: "Humano", FINISHED: "Finalizado" };

/// Na criação createdAt (banco) e updatedAt (Prisma Client) saem com alguns
/// ms de diferença — só conta como edição acima de 1s.
function wasEdited(comment: CrmCardComment): boolean {
  return new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000;
}

interface CrmCardDetailDrawerProps {
  cardId: string | null;
  onOpenChange: (open: boolean) => void;
}

/// Barra de progresso do lead no funil: posição do estágio atual entre todos
/// os estágios do CRM (ordenados por position). Card sem estágio (estágio
/// excluído) fica em 0%.
function StageProgress({ card }: { card: CrmCardDetail }) {
  const stages = [...card.stages].sort((a, b) => a.position - b.position);
  const index = stages.findIndex((stage) => stage.id === card.stagesCrmId);
  const percent = index < 0 || stages.length === 0 ? 0 : ((index + 1) / stages.length) * 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">{index < 0 ? "Sem estágio" : stages[index].nameStage}</span>
        {index >= 0 && (
          <span className="text-muted-foreground">
            Etapa {index + 1} de {stages.length}
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className="bg-muted h-2 w-full overflow-hidden rounded-sm"
      >
        <div className="bg-primary h-full rounded-sm transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/// Drawer lateral aberto ao clicar num card do Kanban — "Detalhes do lead":
/// dados do Target, progresso no funil, metadados editáveis, arquivos (S3) e
/// comentários (ver crm-page.tsx).
export function CrmCardDetailDrawer({ cardId, onOpenChange }: CrmCardDetailDrawerProps) {
  const { data: card, mutate } = useSWR<CrmCardDetail>(cardId ? `/api/crm/cards/${cardId}` : null);
  const { mutate: mutateGlobal } = useSWRConfig();
  const can = useCan();
  const canWrite = can(PermissionAction.CRM_WRITE);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [comment, setComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [deletingCard, setDeletingCard] = useState(false);

  const target = card?.target;

  /// Salva na hora ao escolher e revalida também o Kanban (a prioridade
  /// aparece como badge no card da coluna).
  async function handleChangePriority(statusPriority: CardPriority) {
    if (!card) return;
    try {
      await api.patch(`/api/crm/cards/${card.id}/priority`, { statusPriority });
      toast.success("Prioridade atualizada.");
      await Promise.all([mutate(), mutateGlobal("/api/crm")]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar a prioridade.");
    }
  }

  async function handleSaveMetadata(metadata: Record<string, string>) {
    if (!target) return;
    setSaving(true);
    try {
      await api.patch(`/api/targets/${target.id}/metadata`, { metadata });
      toast.success("Metadados atualizados.");
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar os metadados.");
    } finally {
      setSaving(false);
    }
  }

  /// Mesmo fluxo do upload de documentos de RAG: URL presignada → PUT direto
  /// no S3 → confirma no Agent-Api, que guarda a chave na lista do card.
  async function handleFilesSelected(files: FileList | null) {
    if (!card || !files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const contentType = file.type || "application/octet-stream";
        const { uploadUrl, s3Key } = await api.post<{ uploadUrl: string; s3Key: string }>(
          `/api/crm/cards/${card.id}/attachments/presign`,
          { fileName: file.name, contentType },
        );
        const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
        if (!response.ok) throw new Error(`Falha ao enviar ${file.name}.`);
        await api.post(`/api/crm/cards/${card.id}/attachments`, { s3Key });
      }
      toast.success(files.length > 1 ? "Arquivos anexados." : "Arquivo anexado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível anexar o arquivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await Promise.all([mutate(), mutateGlobal("/api/crm")]);
    }
  }

  /// Só desvincula do card — o arquivo continua no S3.
  async function handleRemoveAttachment(s3Key: string) {
    if (!card) return;
    setRemovingKey(s3Key);
    try {
      await api.delete(`/api/crm/cards/${card.id}/attachments?s3Key=${encodeURIComponent(s3Key)}`);
      toast.success("Arquivo removido do card.");
      await Promise.all([mutate(), mutateGlobal("/api/crm")]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível remover o arquivo.");
    } finally {
      setRemovingKey(null);
    }
  }

  function startEditingComment(commentId: string, text: string) {
    setEditingCommentId(commentId);
    setEditingText(text);
  }

  async function handleUpdateComment(commentId: string) {
    if (!card || editingText.trim().length === 0) return;
    setSavingCommentId(commentId);
    try {
      await api.patch(`/api/crm/cards/${card.id}/comments/${commentId}`, { comment: editingText });
      setEditingCommentId(null);
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível editar o comentário.");
    } finally {
      setSavingCommentId(null);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!card) return;
    setSavingCommentId(commentId);
    try {
      await api.delete(`/api/crm/cards/${card.id}/comments/${commentId}`);
      await Promise.all([mutate(), mutateGlobal("/api/crm")]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível apagar o comentário.");
    } finally {
      setSavingCommentId(null);
    }
  }

  async function handleDeleteCard() {
    if (!card) return;
    setDeletingCard(true);
    try {
      await api.delete(`/api/crm/cards/${card.id}`);
      toast.success("Card apagado.");
      onOpenChange(false);
      await mutateGlobal("/api/crm");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível apagar o card.");
    } finally {
      setDeletingCard(false);
    }
  }

  async function handleSendComment() {
    if (!card || comment.trim().length === 0) return;
    setSendingComment(true);
    try {
      await api.post(`/api/crm/cards/${card.id}/comments`, { comment });
      setComment("");
      await Promise.all([mutate(), mutateGlobal("/api/crm")]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível enviar o comentário.");
    } finally {
      setSendingComment(false);
    }
  }

  return (
    <Drawer direction="right" open={cardId !== null} onOpenChange={onOpenChange}>
      <DrawerContent className="overflow-y-auto sm:max-w-md">
        {!card || !target ? (
          <>
            <DrawerTitle className="sr-only">Detalhes do lead</DrawerTitle>
            <div className="text-muted-foreground p-6 text-sm">Carregando…</div>
          </>
        ) : (
          <>
            <DrawerHeader>
              <DrawerTitle className="text-lg">Detalhes do lead</DrawerTitle>
              <DrawerDescription asChild>
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-base font-medium">
                    {target.name || target.waId || "Contato sem nome"}
                  </span>
                  <Badge variant="outline">{STATUS_LABELS[target.status]}</Badge>
                </div>
              </DrawerDescription>
            </DrawerHeader>

            {/* Botões e inputs do Drawer em h-9 (altura padrão do shadcn); o select define a sua no próprio trigger. */}
            <div className="flex flex-col gap-4 p-4 pt-0 [&_button]:h-9 [&_input]:h-9">
              <StageProgress card={card} />

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Prioridade de atenção</span>
                <Select
                  value={card.statusPriority ?? "LOW"}
                  onValueChange={(value) => void handleChangePriority(value as CardPriority)}
                  disabled={!canWrite}
                >
                  <SelectTrigger className="w-36 data-[size=default]:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {CARD_PRIORITY_LABELS[priority]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Phone className="size-4" /> Telefone
                  </span>
                  <span className="font-medium">{target.waId ?? "Não informado"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Mail className="size-4" /> E-mail
                  </span>
                  <span className="font-medium">{target.email ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="size-4" /> Primeira interação
                  </span>
                  <span className="font-medium">{formatDateAtTime(target.firstInteractionAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <IdCard className="size-4" /> BSUID
                  </span>
                  <span className="font-medium">{target.bsuid ?? "Ainda não recebido"}</span>
                </div>
              </div>

              {card.description && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Descrição</h3>
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">{card.description}</p>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Metadados</h3>
                <MetadataEditor metadata={target.metadata} saving={saving} onSave={handleSaveMetadata} />
              </div>

              <Separator />

              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Arquivos</h3>
                  {canWrite && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => void handleFilesSelected(event.target.files)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                        {uploading ? "Enviando…" : "Anexar arquivo"}
                      </Button>
                    </>
                  )}
                </div>

                {card.attachments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum arquivo anexado ainda.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {card.attachments.map((attachment) => (
                      <li key={attachment.s3Key} className="flex items-center gap-1.5">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:bg-accent flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <FileText className="text-muted-foreground size-4 shrink-0" />
                          <span className="truncate">{attachment.fileName}</span>
                        </a>
                        {canWrite && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9 shrink-0"
                                disabled={removingKey === attachment.s3Key}
                                aria-label={`Remover ${attachment.fileName} do card`}
                              >
                                <Trash2 className="text-destructive size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover "{attachment.fileName}" do card?</AlertDialogTitle>
                                <AlertDialogDescription>O arquivo deixa de aparecer neste card.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() => void handleRemoveAttachment(attachment.s3Key)}
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Comentários</h3>

                <div className="flex flex-col gap-2">
                  <Textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Escreva um comentário…"
                    maxLength={2000}
                    className="min-h-20"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="self-end"
                    disabled={sendingComment || comment.trim().length === 0}
                    onClick={() => void handleSendComment()}
                  >
                    {sendingComment ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Comentar
                  </Button>
                </div>

                {card.comments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum comentário ainda.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {card.comments.map((item) => {
                      // Comentário do agente de IA (user null) não tem dono na tela.
                      const isOwner = !!item.user && item.user.id === currentUserId;
                      const isEditing = editingCommentId === item.id;
                      const busy = savingCommentId === item.id;

                      return (
                        <li key={item.id} className="bg-muted/40 flex flex-col gap-1 rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium">{item.user?.name ?? "Agente de IA"}</span>
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
                                    className="size-7 !h-7"
                                    disabled={busy}
                                    onClick={() => startEditingComment(item.id, item.comment)}
                                    aria-label="Editar comentário"
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 !h-7"
                                        disabled={busy}
                                        aria-label="Apagar comentário"
                                      >
                                        <Trash2 className="text-destructive size-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Apagar comentário?</AlertDialogTitle>
                                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          variant="destructive"
                                          onClick={() => void handleDeleteComment(item.id)}
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
                                onChange={(event) => setEditingText(event.target.value)}
                                maxLength={2000}
                                className="bg-background min-h-20"
                              />
                              <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setEditingCommentId(null)}>
                                  <X className="size-4" /> Cancelar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={busy || editingText.trim().length === 0}
                                  onClick={() => void handleUpdateComment(item.id)}
                                >
                                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                                  Salvar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{item.comment}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <Separator />

              <Link
                to={`/targets/${target.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
              >
                <ExternalLink className="size-4" /> Ver histórico completo do contato
              </Link>

              {canWrite && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" className="text-destructive" disabled={deletingCard}>
                      {deletingCard ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      Apagar card
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apagar o card deste lead?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O card sai do Kanban junto com os comentários e anexos. O contato continua cadastrado. Esta
                        ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => void handleDeleteCard()}>
                        Apagar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
