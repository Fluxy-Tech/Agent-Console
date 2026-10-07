import { MessageCircleReply, Send, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CampaignMetrics } from "@/types/domain";
import { formatNumber } from "./reports-page";

interface ResponseRateCardProps {
  metrics: CampaignMetrics;
}

/// Painel "Taxa de resposta" — antes era um card pequeno que abria uma modal
/// só ao clicar; agora mostra tudo direto na tela: a fração de contatos
/// realmente alcançados sobre o total já processado, com o saldo de envio.
export function ResponseRateCard({ metrics }: ResponseRateCardProps) {
  const { reachedContacts, totalContacts, reachDelta } = metrics;

  const reachPct = totalContacts > 0 ? Math.round((reachedContacts / totalContacts) * 100) : 0;
  const isHealthy = reachDelta === 0;

  return (
    <Card className="h-full shadow-xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="bg-warning/15 text-warning flex size-10 shrink-0 items-center justify-center rounded-lg">
            <MessageCircleReply className="size-5" />
          </div>
          <div>
            <CardTitle>Taxa de resposta</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Do total processado, quantos contatos foram alcançados e quantos deles responderam.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="border-border rounded-lg border p-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold">{formatNumber(reachedContacts)}</span>
            <span className="text-muted-foreground text-sm">de {formatNumber(totalContacts)} contatos</span>
          </div>
          <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-sm">
            <div className="bg-success h-full" style={{ width: `${Math.min(reachPct, 100)}%` }} />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            {reachPct}% de todos os contatos processados em campanhas foram efetivamente alcançados.
          </p>
        </div>

        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3",
            isHealthy ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10",
          )}
        >
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              isHealthy ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {isHealthy ? <Send className="size-4" /> : <TriangleAlert className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Contato(s) que não foram alcançados apesar de processados.</p>
            <p className={cn("text-lg font-semibold", isHealthy ? "text-success" : "text-destructive")}>
              {formatNumber(reachDelta)}
            </p>
            {isHealthy && (
              <p className="text-muted-foreground text-xs">Nenhuma falha de envio: todo contato processado foi alcançado.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
