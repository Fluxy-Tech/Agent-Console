import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignMetrics } from "@/types/domain";
import { formatNumber } from "./reports-page";

interface ResponsesByWeekdayCardProps {
  metrics: CampaignMetrics;
}

/// Painel "Respostas por dia da semana" — Segunda a Domingo, quantos disparos
/// alcançaram o contato naquele dia e qual fração já tem resposta do cliente
/// vinculada (CampaignTarget.respondedCampaign). Todos os contatos da empresa
/// ativa, sem os filtros da lista de campanhas.
export function ResponsesByWeekdayCard({ metrics }: ResponsesByWeekdayCardProps) {
  const { responsesByWeekday } = metrics;
  const maxTotal = Math.max(1, ...responsesByWeekday.map((w) => w.total));
  // Melhor dia = quem tem mais respostas em número absoluto (mais alcance de
  // verdade), não a maior taxa — 1 disparo com 100% não é melhor que 2
  // disparos com 100%. Taxa só desempata quando o volume de respostas empata.
  const bestDay = responsesByWeekday.reduce<(typeof responsesByWeekday)[number] | null>((best, w) => {
    if (w.total === 0) return best;
    if (!best) return w;
    if (w.responded !== best.responded) return w.responded > best.responded ? w : best;
    return (w.responseRate ?? 0) > (best.responseRate ?? 0) ? w : best;
  }, null);

  return (
    <Card className="h-full shadow-xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <CardTitle>Melhores dias da semana para enviar campanhas</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Em qual dia da semana os disparos de campanha alcançam os contatos e em qual desses dias eles respondem
              mais.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {bestDay ? (
          <p className="text-muted-foreground text-sm">
            Dia com mais resultado: <span className="text-foreground font-medium">{bestDay.weekday}</span>.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">Dia com mais resultado: no momento não há disparos suficientes para definir.</p>
        )}

        <div className="flex flex-col gap-2">
          {responsesByWeekday.map((w) => (
            <div key={w.weekday} className="flex items-center gap-3">
              <span className="text-muted-foreground w-16 shrink-0 text-xs">{w.weekday}</span>
              <div className="bg-muted relative h-5 flex-1 overflow-hidden rounded-md">
                <div
                  className="bg-primary/20 absolute inset-y-0 left-0 rounded-md"
                  style={{ width: `${(w.total / maxTotal) * 100}%` }}
                />
                <div
                  className="bg-primary absolute inset-y-0 left-0 rounded-md"
                  style={{ width: `${w.total > 0 ? (w.responded / maxTotal) * 100 : 0}%` }}
                />
              </div>
              <span className="text-muted-foreground w-28 shrink-0 text-right text-xs">
                {w.total === 0 ? "sem disparos" : `${formatNumber(w.responded)} de ${formatNumber(w.total)} (${(w.responseRate ?? 0).toFixed(0)}%)`}
              </span>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground text-xs">Abaixo segue a legenda dos dados apresentados:</p>

        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="bg-primary/20 size-3 shrink-0 rounded-sm" />
            <span className="text-muted-foreground">Campanhas que alcançaram os contatos</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="bg-primary size-3 shrink-0 rounded-sm" />
            <span className="text-muted-foreground">Clientes que responderam as campanhas</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="bg-muted border-border size-3 shrink-0 rounded-sm border" />
            <span className="text-muted-foreground">Não houve disparos nesse dia</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
