import { type FormEvent, useEffect, useState } from "react";
import useSWR from "swr";
import { Check, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CalendarEventDetail, CalendarEventTarget } from "@/types/domain";

interface CrmCalendarEventFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /// Com evento: edita. Sem: cria, já com `defaultDate` preenchida (dia
  /// clicado na grade ou agora).
  event?: CalendarEventDetail | null;
  defaultDate?: Date | null;
  onSaved: (eventId: string) => void;
}

/// "yyyy-MM-ddTHH:mm" no fuso local — formato do input datetime-local.
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function targetLabel(target: CalendarEventTarget): string {
  return target.name || target.waId || "Contato sem nome";
}

export function CrmCalendarEventFormDrawer({
  open,
  onOpenChange,
  event,
  defaultDate,
  onSaved,
}: CrmCalendarEventFormDrawerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dateEvent, setDateEvent] = useState("");
  const [target, setTarget] = useState<CalendarEventTarget | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = new URLSearchParams();
  if (search.trim()) searchParams.set("q", search.trim());
  const { data: targets } = useSWR<CalendarEventTarget[]>(
    open ? `/api/crm/calendar/targets?${searchParams.toString()}` : null,
  );

  useEffect(() => {
    if (!open) return;
    setName(event?.name ?? "");
    setDescription(event?.description ?? "");
    setDateEvent(toDateTimeLocal(event ? new Date(event.dateEvent) : (defaultDate ?? new Date())));
    setTarget(event?.target ?? null);
    setSearch("");
    setError(null);
  }, [open, event, defaultDate]);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!target) {
      setError("Selecione o contato do evento.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const body = {
        name,
        description: description.trim() || null,
        dateEvent: new Date(dateEvent).toISOString(),
        targetId: target.id,
      };
      const saved = event
        ? await api.patch<{ id: string }>(`/api/crm/calendar/events/${event.id}`, body)
        : await api.post<{ id: string }>("/api/crm/calendar/events", body);
      onOpenChange(false);
      onSaved(saved.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o evento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="overflow-y-auto sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle className="text-lg">{event ? "Editar evento" : "Criar evento"}</DrawerTitle>
          <DrawerDescription>Defina o nome, a data e o contato deste evento.</DrawerDescription>
        </DrawerHeader>
        {/* data-vaul-no-drag: sem isso o vaul trata o clique como início de
            arrasto do drawer e o seletor nativo de data/hora não abre. */}
        <form data-vaul-no-drag className="flex flex-col gap-4 p-4 pt-0" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-name">Nome</Label>
            <Input id="event-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-date">Data e hora</Label>
            <Input
              id="event-date"
              type="datetime-local"
              required
              value={dateEvent}
              onChange={(e) => setDateEvent(e.target.value)}
              onClick={(e) => {
                // Abre o calendário no clique em qualquer parte do campo, não só no ícone.
                try {
                  e.currentTarget.showPicker?.();
                } catch {
                  // Navegador sem showPicker: fica o comportamento nativo.
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-description">Descrição (opcional)</Label>
            <Textarea
              id="event-description"
              value={description}
              maxLength={5000}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-target-search">Contato</Label>
            {target && (
              <p className="text-sm">
                Selecionado: <span className="font-medium">{targetLabel(target)}</span>
                {target.waId && target.name && <span className="text-muted-foreground"> · {target.waId}</span>}
              </p>
            )}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                id="event-target-search"
                placeholder="Buscar por nome ou telefone..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex max-h-44 flex-col overflow-y-auto rounded-md border">
              {!targets ? (
                <p className="text-muted-foreground p-3 text-xs">Carregando…</p>
              ) : targets.length === 0 ? (
                <p className="text-muted-foreground p-3 text-xs">Nenhum contato encontrado.</p>
              ) : (
                targets.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTarget(item)}
                    className={cn(
                      "hover:bg-muted/60 flex items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0",
                      target?.id === item.id && "bg-primary/10",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{targetLabel(item)}</span>
                      {item.waId && item.name && (
                        <span className="text-muted-foreground block truncate text-xs">{item.waId}</span>
                      )}
                    </span>
                    {target?.id === item.id && <Check className="text-primary size-4 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button loading={saving} type="submit" disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando…" : event ? "Salvar alterações" : "Criar evento"}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
