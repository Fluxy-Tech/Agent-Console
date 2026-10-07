import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PermissionAction } from "@/domain/permission-action";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import type { CalendarEventSummary } from "@/types/domain";
import { CALENDAR_STATUS_CHIP_CLASSES, CALENDAR_STATUS_LABELS, statusKey } from "./calendar-event-status";
import { CrmCalendarEventDrawer } from "./crm-calendar-event-drawer";
import { CrmCalendarEventFormDrawer } from "./crm-calendar-event-form-drawer";

type CalendarView = "day" | "week" | "month";

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/// Eventos visíveis por dia na visão mensal antes de virar "+N mais".
const MAX_EVENTS_PER_DAY = 3;
/// Visão mensal: sempre 6 semanas — a altura não pula de um mês pro outro.
const MONTH_GRID_DAYS = 42;
/// Visões dia/semana: altura de cada hora na grade de horários (px).
const HOUR_HEIGHT = 48;
/// Evento não tem duração no banco — na grade de horários ocupa 1h.
const EVENT_DURATION_MIN = 60;
/// Hora em que a grade de horários abre rolada (antes disso quase não há evento).
const SCROLL_TO_HOUR = 7;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  return addDays(day, -day.getDay());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/// Dias exibidos em cada visão (a visão mensal inclui as semanas vizinhas).
function visibleDays(view: CalendarView, anchor: Date): Date[] {
  if (view === "day") return [startOfDay(anchor)];
  if (view === "week") {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const start = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: MONTH_GRID_DAYS }, (_, i) => addDays(start, i));
}

function shiftAnchor(view: CalendarView, anchor: Date, direction: 1 | -1): Date {
  if (view === "day") return addDays(anchor, direction);
  if (view === "week") return addDays(anchor, 7 * direction);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

function periodLabel(view: CalendarView, anchor: Date, days: Date[]): string {
  if (view === "day") {
    return anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  if (view === "week") {
    const first = days[0];
    const last = days[days.length - 1];
    const sameMonth = first.getMonth() === last.getMonth();
    const start = first.toLocaleDateString("pt-BR", sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
    const end = last.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
    return `${start} – ${end}`;
  }
  return anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function EventChip({
  event,
  onOpen,
  className,
  showTime = true,
}: {
  event: CalendarEventSummary;
  onOpen: (id: string) => void;
  className?: string;
  showTime?: boolean;
}) {
  const key = statusKey(event.status);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event.id);
      }}
      title={`${event.name} · ${event.target.name || event.target.waId || "Contato"} · ${CALENDAR_STATUS_LABELS[key]}`}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-80",
        CALENDAR_STATUS_CHIP_CLASSES[key],
        className,
      )}
    >
      {event.isClosed && <Lock className="size-3 shrink-0" />}
      {showTime && <span className="shrink-0">{formatTime(event.dateEvent)}</span>}
      <span className="truncate">{event.name}</span>
    </button>
  );
}

// ---------- VISÃO MENSAL ----------

function MonthView({
  anchor,
  days,
  eventsByDay,
  canWrite,
  onCreate,
  onOpen,
}: {
  anchor: Date;
  days: Date[];
  eventsByDay: Map<string, CalendarEventSummary[]>;
  canWrite: boolean;
  onCreate: (date: Date) => void;
  onOpen: (id: string) => void;
}) {
  const today = new Date();

  return (
    <div className="bg-card overflow-hidden rounded-xl">
      <div className="border-border grid grid-cols-7 border-b">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-muted-foreground py-2 text-center text-xs font-medium uppercase">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
          const inMonth = day.getMonth() === anchor.getMonth();
          const hidden = dayEvents.length - MAX_EVENTS_PER_DAY;
          // Dia clicado entra às 09:00.
          const createAt = new Date(day);
          createAt.setHours(9, 0, 0, 0);

          return (
            <div
              key={day.toISOString()}
              role={canWrite ? "button" : undefined}
              tabIndex={canWrite ? 0 : undefined}
              onClick={() => onCreate(createAt)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreate(createAt);
              }}
              className={cn(
                "border-border flex min-h-28 flex-col gap-1 p-1.5",
                index % 7 !== 6 && "border-r",
                index < days.length - 7 && "border-b",
                !inMonth && "bg-muted/30",
                canWrite && "hover:bg-muted/40 cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center self-center rounded-sm text-xs",
                  sameDay(day, today)
                    ? "bg-primary text-primary-foreground font-semibold"
                    : inMonth
                      ? ""
                      : "text-muted-foreground",
                )}
              >
                {day.getDate()}
              </span>

              {dayEvents.slice(0, MAX_EVENTS_PER_DAY).map((event) => (
                <EventChip key={event.id} event={event} onOpen={onOpen} />
              ))}

              {hidden > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground px-1.5 text-left text-[11px] font-medium"
                    >
                      +{hidden} mais
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="flex w-64 flex-col gap-1 p-2" onClick={(e) => e.stopPropagation()}>
                    <p className="mb-1 px-1 text-xs font-semibold">
                      {day.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    {dayEvents.map((event) => (
                      <EventChip key={event.id} event={event} onOpen={onOpen} />
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- VISÕES DIA / SEMANA (grade de horários) ----------

/// Eventos que se sobrepõem (começam dentro da 1h de outro) dividem a largura
/// da coluna lado a lado, como no Google Agenda.
function layoutDayEvents(events: CalendarEventSummary[]) {
  const sorted = [...events].sort((a, b) => new Date(a.dateEvent).getTime() - new Date(b.dateEvent).getTime());
  const result: { event: CalendarEventSummary; lane: number; lanes: number }[] = [];

  let cluster: CalendarEventSummary[] = [];
  let clusterEnd = 0;
  const flush = () => {
    cluster.forEach((event, lane) => result.push({ event, lane, lanes: cluster.length }));
    cluster = [];
  };

  for (const event of sorted) {
    const start = new Date(event.dateEvent).getTime();
    if (cluster.length > 0 && start >= clusterEnd) flush();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, start + EVENT_DURATION_MIN * 60_000);
  }
  flush();

  return result;
}

function TimeGridView({
  days,
  eventsByDay,
  canWrite,
  onCreate,
  onOpen,
}: {
  days: Date[];
  eventsByDay: Map<string, CalendarEventSummary[]>;
  canWrite: boolean;
  onCreate: (date: Date) => void;
  onOpen: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const gridTemplate = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = SCROLL_TO_HOUR * HOUR_HEIGHT;
  }, []);

  // Linha do "agora" anda sozinha enquanto a aba fica aberta.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-card overflow-hidden rounded-xl">
      <div className="border-border grid border-b" style={gridTemplate}>
        <div />
        {days.map((day) => {
          const isToday = sameDay(day, now);
          return (
            <div key={day.toISOString()} className="flex flex-col items-center gap-0.5 py-2">
              <span className={cn("text-xs font-medium uppercase", isToday ? "text-primary" : "text-muted-foreground")}>
                {WEEKDAY_LABELS[day.getDay()]}
              </span>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-sm text-base",
                  isToday && "bg-primary text-primary-foreground font-semibold",
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="max-h-[36rem] overflow-y-auto">
        <div className="relative grid" style={gridTemplate}>
          <div>
            {hours.map((hour) => (
              <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                {hour > 0 && (
                  <span className="text-muted-foreground absolute -top-2 right-2 text-[10px]">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayEvents = layoutDayEvents(eventsByDay.get(dayKey(day)) ?? []);
            const isToday = sameDay(day, now);
            const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

            return (
              <div key={day.toISOString()} className="border-border relative border-l">
                {hours.map((hour) => {
                  const slot = new Date(day);
                  slot.setHours(hour, 0, 0, 0);
                  return (
                    <div
                      key={hour}
                      role={canWrite ? "button" : undefined}
                      tabIndex={canWrite ? 0 : undefined}
                      onClick={() => onCreate(slot)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onCreate(slot);
                      }}
                      className={cn("border-border border-b", canWrite && "hover:bg-muted/40 cursor-pointer")}
                      style={{ height: HOUR_HEIGHT }}
                    />
                  );
                })}

                {dayEvents.map(({ event, lane, lanes }) => {
                  const start = new Date(event.dateEvent);
                  const top = ((start.getHours() * 60 + start.getMinutes()) / 60) * HOUR_HEIGHT;
                  return (
                    <div
                      key={event.id}
                      className="absolute px-0.5"
                      style={{
                        top,
                        height: (EVENT_DURATION_MIN / 60) * HOUR_HEIGHT - 2,
                        left: `${(lane / lanes) * 100}%`,
                        width: `${100 / lanes}%`,
                      }}
                    >
                      <EventChip
                        event={event}
                        onOpen={onOpen}
                        showTime={false}
                        className="h-full flex-col items-start justify-start gap-0 py-1 whitespace-normal"
                      />
                    </div>
                  );
                })}

                {isToday && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                    <div className="bg-destructive absolute -top-1 -left-1 size-2 rounded-sm" />
                    <div className="bg-destructive h-0.5 w-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/// Aba "Calendário" do Kanban Board: visões Dia, Semana e Mês no estilo
/// Google Agenda com os eventos da empresa ativa. Clicar num horário/dia vazio
/// cria um evento ali; clicar num evento abre o detalhe.
export function CrmCalendarTab() {
  const can = useCan();
  const canWrite = can(PermissionAction.CRM_WRITE);
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);

  const days = visibleDays(view, anchor);
  const rangeEnd = new Date(addDays(days[days.length - 1], 1).getTime() - 1);
  const range = new URLSearchParams({ from: days[0].toISOString(), to: rangeEnd.toISOString() });
  const { data: events, mutate } = useSWR<CalendarEventSummary[]>(`/api/crm/calendar/events?${range.toString()}`);

  const eventsByDay = new Map<string, CalendarEventSummary[]>();
  for (const event of events ?? []) {
    const key = dayKey(new Date(event.dateEvent));
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }

  function openCreate(date: Date | null) {
    if (!canWrite) return;
    // Sem data (botão "Criar evento"): próxima hora cheia.
    if (date) {
      setCreateDate(date);
    } else {
      const next = new Date();
      next.setHours(next.getHours() + 1, 0, 0, 0);
      setCreateDate(next);
    }
    setCreateOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>
            Hoje
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Período anterior"
            onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Próximo período"
            onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold first-letter:uppercase">{periodLabel(view, anchor, days)}</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-muted flex rounded-lg p-[3px]">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  view === option.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {canWrite && (
            <Button size="sm" onClick={() => openCreate(null)}>
              <Plus className="size-4" /> Criar evento
            </Button>
          )}
        </div>
      </div>

      {view === "month" ? (
        <MonthView
          anchor={anchor}
          days={days}
          eventsByDay={eventsByDay}
          canWrite={canWrite}
          onCreate={openCreate}
          onOpen={setSelectedEventId}
        />
      ) : (
        <TimeGridView
          key={view}
          days={days}
          eventsByDay={eventsByDay}
          canWrite={canWrite}
          onCreate={openCreate}
          onOpen={setSelectedEventId}
        />
      )}

      <CrmCalendarEventFormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDate={createDate}
        onSaved={(eventId) => {
          void mutate();
          setSelectedEventId(eventId);
        }}
      />

      <CrmCalendarEventDrawer
        eventId={selectedEventId}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
        onChanged={() => void mutate()}
      />
    </div>
  );
}
