import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  Check,
  Funnel,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Settings,
  SquareKanban,
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
import { Input } from "@/components/ui/input";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/hooks/use-can";
import { PermissionAction } from "@/domain/permission-action";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CARD_PRIORITY_LABELS, type CrmCard, type CrmStage } from "@/types/domain";
import { CARD_PRIORITY_DOT_CLASSES } from "./card-priority";
import { CrmCardDetailDrawer } from "./crm-card-detail-drawer";
import { CrmCalendarTab } from "./crm-calendar-tab";
import { CrmSettingsTab } from "./crm-settings-tab";
import { CrmFunnelTab } from "./crm-funnel-tab";
import { CrmStageFormDialog } from "./crm-stage-form-dialog";

function CrmCardItem({ card, canDrag, onOpen }: { card: CrmCard; canDrag: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: !canDrag,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn(
        "bg-card border-border flex w-full flex-col gap-1 rounded-lg border p-3 text-left shadow-sm",
        isDragging && "z-10 opacity-70",
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-2.5">
        <div className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium">
          {(card.target.name || card.target.waId || "?").trim().charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {card.target.name || card.target.waId || "Contato sem nome"}
          </span>
          <span className="text-muted-foreground truncate text-xs">{card.target.waId ?? "Telefone não informado"}</span>
        </div>
      </div>
      <div className="border-border mt-1 flex items-center justify-between gap-2 border-t pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge variant="outline" className="w-fit shrink-0 gap-1.5 text-[10px]">
            <span className={cn("size-2 rounded-full", CARD_PRIORITY_DOT_CLASSES[card.statusPriority ?? "LOW"])} />
            {CARD_PRIORITY_LABELS[card.statusPriority ?? "LOW"]}
          </Badge>
          <span className="text-muted-foreground truncate text-[10px]">
            {new Date(card.updatedAt).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-[11px]">
          <span className="flex items-center gap-0.5" title="Arquivos anexados">
            <Paperclip className="size-3" /> {card.attachments.length}
          </span>
          <span className="flex items-center gap-0.5" title="Comentários">
            <MessageSquare className="size-3" /> {card._count.comments}
          </span>
        </div>
      </div>
    </button>
  );
}

function StageColumn({
  stage,
  canDrag,
  canWrite,
  onOpenCard,
  onRename,
  onDelete,
}: {
  stage: CrmStage;
  canDrag: boolean;
  canWrite: boolean;
  onOpenCard: (cardId: string) => void;
  onRename: (stageId: string, nameStage: string) => Promise<void>;
  onDelete: (stageId: string) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.nameStage);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setName(stage.nameStage);
    setEditing(true);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === stage.nameStage) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(stage.id, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-muted/40 flex w-72 shrink-0 flex-col gap-3 rounded-xl border p-3 transition-colors",
        isOver ? "border-primary" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        {editing ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-7 text-sm"
            />
            <Button type="button" variant="ghost" size="icon" className="size-7" disabled={saving} onClick={handleSave}>
              <Check className="size-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => setEditing(false)}>
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold">{stage.nameStage}</h3>
              <Badge variant="secondary">{stage.cards.length}</Badge>
            </div>
            {canWrite && (
              <div className="flex shrink-0 items-center gap-0.5">
                <Button type="button" variant="ghost" size="icon" className="size-7" onClick={startEditing}>
                  <Pencil className="size-3.5" />
                </Button>
                {!stage.isDefault && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="size-7">
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir estágio "{stage.nameStage}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Os cards deste estágio não são excluídos — ficam sem estágio até serem movidos para outra
                          coluna. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => onDelete(stage.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex min-h-16 flex-col gap-2">
        {stage.cards.map((card) => (
          <CrmCardItem key={card.id} card={card} canDrag={canDrag} onOpen={() => onOpenCard(card.id)} />
        ))}
        {stage.cards.length === 0 && <p className="text-muted-foreground px-1 text-xs">Nenhum card aqui.</p>}
      </div>
    </div>
  );
}

export function CrmPage() {
  const can = useCan();
  const canWrite = can(PermissionAction.CRM_WRITE);
  const { data, mutate } = useSWR<{ stages: CrmStage[] }>("/api/crm");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [tab, setTab] = useState("kanban");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const stages = data?.stages ?? [];
  const nextPosition = stages.length === 0 ? 1 : Math.max(...stages.map((s) => s.position)) + 1;

  async function handleRenameStage(stageId: string, nameStage: string) {
    try {
      await api.patch(`/api/crm/stages/${stageId}`, { nameStage });
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível renomear o estágio.");
    }
  }

  async function handleDeleteStage(stageId: string) {
    try {
      await api.delete(`/api/crm/stages/${stageId}`);
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o estágio.");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const cardId = String(event.active.id);
    const targetStageId = event.over ? String(event.over.id) : null;
    if (!targetStageId || !data) return;

    const currentStage = stages.find((s) => s.cards.some((c) => c.id === cardId));
    if (!currentStage || currentStage.id === targetStageId) return;

    const card = currentStage.cards.find((c) => c.id === cardId)!;

    // Otimista: move o card entre as colunas localmente antes da resposta da API.
    const optimisticStages = stages.map((stage) => {
      if (stage.id === currentStage.id) {
        return { ...stage, cards: stage.cards.filter((c) => c.id !== cardId) };
      }
      if (stage.id === targetStageId) {
        return { ...stage, cards: [...stage.cards, { ...card, stagesCrmId: targetStageId }] };
      }
      return stage;
    });
    await mutate({ stages: optimisticStages }, { revalidate: false });

    try {
      await api.patch(`/api/crm/cards/${cardId}/move`, { stagesCrmId: targetStageId });
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível mover o card.");
      await mutate();
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Kanban Board", to: "/crm" }, { label: "Início" }]} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Kanban Board</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Acompanhe seus leads em formato Kanban e arraste os cards entre os estágios.
          </p>
        </div>
        {canWrite && tab === "kanban" && (
          <CrmStageFormDialog
            nextPosition={nextPosition}
            onSaved={() => mutate()}
            trigger={
              <Button size="sm">
                <Plus className="size-4" /> Novo estágio
              </Button>
            }
          />
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="kanban">
            <SquareKanban /> Kanban
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays /> Calendário
          </TabsTrigger>
          <TabsTrigger value="funnel">
            <Funnel /> Funil de conversões
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {stages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  canDrag={canWrite}
                  canWrite={canWrite}
                  onOpenCard={setSelectedCardId}
                  onRename={handleRenameStage}
                  onDelete={handleDeleteStage}
                />
              ))}
            </div>
          </DndContext>
        </TabsContent>

        <TabsContent value="funnel">
          <CrmFunnelTab />
        </TabsContent>

        <TabsContent value="calendar">
          <CrmCalendarTab />
        </TabsContent>

        <TabsContent value="settings">
          <CrmSettingsTab />
        </TabsContent>
      </Tabs>

      <CrmCardDetailDrawer cardId={selectedCardId} onOpenChange={(open) => !open && setSelectedCardId(null)} />
    </div>
  );
}
