import { type ReactNode, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { useCan } from "@/hooks/use-can";
import { PermissionAction } from "@/domain/permission-action";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CrmFunnel, CrmFunnelField } from "@/types/domain";
import { CrmFunnelFieldDialog } from "./crm-funnel-field-dialog";
import { CrmFunnelTargetsDialog } from "./crm-funnel-targets-dialog";

/// Largura (% do container) do topo e da base do funil — as etapas afunilam
/// por posição, não pela contagem, pra forma ficar sempre legível.
const TOP_WIDTH = 100;
const BOTTOM_WIDTH = 45;

function levelWidths(levels: number): number[] {
  const step = levels > 1 ? (TOP_WIDTH - BOTTOM_WIDTH) / (levels - 1) : 0;
  return Array.from({ length: levels }, (_, i) => TOP_WIDTH - i * step);
}

function formatPercent(count: number, total: number) {
  if (total === 0) return "0%";
  return `${((count / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/// Segmento trapezoidal: a base de cada nível casa com o topo do próximo.
function FunnelSegment({
  width,
  nextWidth,
  onClick,
  children,
  className,
}: {
  width: number;
  nextWidth: number;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const inset = ((width - nextWidth) / 2 / width) * 100;
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{ width: `${width}%`, clipPath: `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)` }}
      className={cn(
        "mx-auto flex h-16 flex-col items-center justify-center px-10 text-center transition-[filter]",
        onClick && "cursor-pointer hover:brightness-110",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function CrmFunnelTab() {
  const can = useCan();
  const canWrite = can(PermissionAction.CRM_WRITE);
  const { data, mutate } = useSWR<CrmFunnel>("/api/crm/funnel");
  const [selectedField, setSelectedField] = useState<CrmFunnelField | null>(null);

  const fields = data?.fields ?? [];
  const totalTargets = data?.totalTargets ?? 0;
  // Nível 0 é "Todos os contatos"; o último ganha uma base um pouco mais estreita.
  const widths = levelWidths(fields.length + 1);
  const baseWidth = widths[widths.length - 1] - (widths.length > 1 ? widths[0] - widths[1] : 10);

  async function handleDelete(fieldId: string) {
    try {
      await api.delete(`/api/crm/funnel/fields/${fieldId}`);
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir a etapa.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Funil de conversões</h2>
          <p className="text-muted-foreground text-sm">
            Cada etapa olha para um campo dos metadados do contato. Clique numa etapa para ver os contatos.
          </p>
        </div>
        {canWrite && (
          <CrmFunnelFieldDialog
            onSaved={() => mutate()}
            trigger={
              <Button size="sm">
                <Plus className="size-4" /> Nova etapa
              </Button>
            }
          />
        )}
      </div>

      {!data ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : (
        <div className="bg-card flex flex-col gap-1 rounded-xl p-6">
          <div className="grid grid-cols-[1fr_4.5rem] items-center gap-3">
            <FunnelSegment
              width={widths[0]}
              nextWidth={widths[1] ?? baseWidth}
              className="bg-muted text-foreground"
            >
              <span className="text-sm font-medium">Todos os contatos</span>
              <span className="text-muted-foreground text-xs">{totalTargets.toLocaleString("pt-BR")}</span>
            </FunnelSegment>
            <span />
          </div>

          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_4.5rem] items-center gap-3">
              <FunnelSegment
                width={widths[i + 1]}
                nextWidth={widths[i + 2] ?? baseWidth}
                onClick={() => setSelectedField(field)}
                className="bg-primary text-primary-foreground"
              >
                <span className="max-w-full truncate font-mono text-sm font-medium">{field.name}</span>
                <span className="text-xs opacity-90">
                  {field.count.toLocaleString("pt-BR")} · {formatPercent(field.count, totalTargets)}
                  {field.useValue && <> · = "{field.value}"</>}
                </span>
              </FunnelSegment>

              {canWrite ? (
                <div className="flex items-center gap-0.5">
                  <CrmFunnelFieldDialog
                    field={field}
                    onSaved={() => mutate()}
                    trigger={
                      <Button type="button" variant="ghost" size="icon" className="size-8">
                        <Pencil className="size-3.5" />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="size-8">
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir etapa "{field.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Os metadados dos contatos não são alterados — só a etapa sai do funil.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => handleDelete(field.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <span />
              )}
            </div>
          ))}

          {fields.length === 0 && (
            <p className="text-muted-foreground mt-4 text-center text-sm">
              Nenhuma etapa criada ainda. {canWrite && 'Use "Nova etapa" para começar.'}
            </p>
          )}
        </div>
      )}

      <CrmFunnelTargetsDialog field={selectedField} onOpenChange={(open) => !open && setSelectedField(null)} />
    </div>
  );
}
