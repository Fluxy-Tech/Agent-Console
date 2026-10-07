import { BrainCircuit, Coins, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SeriesPeriod, TokenUsage } from "@/types/domain";
import {
  buildYearOptions,
  formatBucketLabel,
  formatBucketTick,
  formatPeriodLabel,
} from "../channels/chart-range-utils";

const chartConfig = {
  ADK: { label: "ADK (Gemini)", color: "var(--chart-1)" },
  OPENAI: { label: "OpenAI", color: "var(--chart-2)" },
} satisfies ChartConfig;

const PERIOD_OPTIONS: SeriesPeriod[] = ["current-month", ...buildYearOptions()];

const numberFormat = new Intl.NumberFormat("pt-BR");

export function formatTokens(value: number): string {
  return numberFormat.format(value);
}

function percentOf(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}% do total` : "Sem consumo no período";
}

export function TokenPeriodSelect({
  period,
  onChange,
}: {
  period: SeriesPeriod;
  onChange: (period: SeriesPeriod) => void;
}) {
  return (
    <Select
      value={String(period)}
      onValueChange={(value) => onChange(value === "current-month" ? "current-month" : Number(value))}
    >
      <SelectTrigger className="w-full sm:w-[180px]" aria-label="Selecionar período">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map((option) => (
          <SelectItem key={String(option)} value={String(option)}>
            {formatPeriodLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/// Métricas de consumo de tokens (total + por LLM) e o gráfico empilhado por
/// origem — usado na lista de Agentes (empresa inteira) e na aba "Consumo"
/// do detalhe do agente. Quem chama busca os dados e controla o período.
export function TokenUsageOverview({
  data,
  period,
  onPeriodChange,
  totalLabel,
  chartTitle,
  chartDescription,
}: {
  data: TokenUsage | undefined;
  period: SeriesPeriod;
  onPeriodChange: (period: SeriesPeriod) => void;
  totalLabel: string;
  chartTitle: string;
  chartDescription: string;
}) {
  const total = data?.total ?? 0;
  const periodLabel = formatPeriodLabel(period);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Coins}
          iconClassName="bg-primary/10 text-primary"
          label={totalLabel}
          value={data ? formatTokens(total) : "…"}
          sublabel={`Tokens consumidos · ${periodLabel}`}
        />
        <MetricCard
          icon={Sparkles}
          iconClassName="bg-primary/10 text-primary"
          label="ADK (Gemini)"
          value={data ? formatTokens(data.byOrigin.ADK) : "…"}
          sublabel={percentOf(data?.byOrigin.ADK ?? 0, total)}
        />
        <MetricCard
          icon={BrainCircuit}
          iconClassName="bg-success/15 text-success"
          label="OpenAI"
          value={data ? formatTokens(data.byOrigin.OPENAI) : "…"}
          sublabel={percentOf(data?.byOrigin.OPENAI ?? 0, total)}
        />
      </div>

      <Card className="pt-0 shadow-xl">
        <CardHeader className="flex flex-col gap-3 space-y-0 border-b py-5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-3">
            <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Coins className="size-5" />
            </div>
            <div className="grid gap-1">
              <CardTitle>{chartTitle}</CardTitle>
              <p className="text-muted-foreground text-sm">{chartDescription}</p>
            </div>
          </div>
          <div className="sm:ml-auto">
            <TokenPeriodSelect period={period} onChange={onPeriodChange} />
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          {!data ? (
            <p className="text-muted-foreground py-10 text-center text-sm">Carregando…</p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
              <BarChart data={data.points}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value: string) => formatBucketTick(value, data.granularity)}
                />
                {/* Mesmo cuidado do Fluxo de mensagens: domínio a partir de 0
                    com teto mínimo 1, senão período zerado vira barra no meio. */}
                <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, 1)]} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => formatBucketLabel(value as string, data.granularity)}
                      indicator="dot"
                    />
                  }
                />
                <Bar dataKey="ADK" stackId="tokens" fill="var(--color-ADK)" />
                <Bar dataKey="OPENAI" stackId="tokens" fill="var(--color-OPENAI)" radius={[4, 4, 0, 0]} />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
