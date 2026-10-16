import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export interface DateRange {
  from?: Date;
  to?: Date;
}

interface CalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected: DateRange;
  onSelect: (range: DateRange) => void;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/// 6 semanas fixas (42 células) começando no domingo anterior (ou igual) ao
/// dia 1 do mês exibido — inclui dias do mês anterior/seguinte pra preencher
/// a grade, igual a qualquer calendário de seleção de intervalo.
function buildMonthGrid(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

export function Calendar({ month, onMonthChange, selected, onSelect }: CalendarProps) {
  const days = buildMonthGrid(month);
  const today = startOfDay(new Date());

  function handleDayClick(day: Date) {
    const clicked = startOfDay(day);
    if (!selected.from || (selected.from && selected.to)) {
      onSelect({ from: clicked, to: undefined });
      return;
    }
    if (clicked < selected.from) {
      onSelect({ from: clicked, to: selected.from });
    } else {
      onSelect({ from: selected.from, to: clicked });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">
          {MONTH_LABELS[month.getMonth()]} {month.getFullYear()}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="text-muted-foreground py-1 text-xs font-medium">
            {label}
          </span>
        ))}
        {days.map((day, i) => {
          const isCurrentMonth = day.getMonth() === month.getMonth();
          const isFrom = selected.from && isSameDay(day, selected.from);
          const isTo = selected.to && isSameDay(day, selected.to);
          const isInRange = selected.from && selected.to && day > selected.from && day < selected.to;
          const isToday = isSameDay(day, today);

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                "flex size-8 items-center justify-center rounded-md text-sm transition-colors",
                !isCurrentMonth && "text-muted-foreground/40",
                isCurrentMonth && !isFrom && !isTo && !isInRange && "hover:bg-accent",
                isInRange && "bg-accent rounded-none",
                (isFrom || isTo) && "bg-primary text-primary-foreground hover:bg-primary",
                isToday && !isFrom && !isTo && "border-primary border",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
