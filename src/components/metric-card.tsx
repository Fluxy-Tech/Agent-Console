import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string | number;
  sublabel: string;
  /// Opcional — quando presente, o card vira um botão (ex: abre um modal com
  /// o detalhamento daquele número).
  onClick?: () => void;
}

/// iconClassName sempre traz "bg-*" (fundo do círculo do ícone) + "text-*"
/// (cor do ícone) juntos numa string só — o sublabel reusa só a parte de cor
/// de texto, pra ficar na mesma cor do ícone sem herdar o fundo.
function extractTextClasses(className?: string): string | undefined {
  return className
    ?.split(/\s+/)
    .filter((cls) => cls.includes("text-"))
    .join(" ");
}

/// 1 card da fileira de métricas no topo das telas de Campanhas/Contatos —
/// ícone colorido + label, número grande, sublabel pequeno. Reusado por
/// várias telas. Com `onClick`, vira um botão real (não Card+div) com
/// affordance de clique, pra manter a semântica/acessibilidade certa.
/// Número e sublabel ficam alinhados com o label (não com o ícone) — todo o
/// texto começa na mesma coluna, à direita do círculo do ícone.
export function MetricCard({ icon: Icon, iconClassName, label, value, sublabel, onClick }: MetricCardProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "bg-card text-card-foreground flex items-start gap-3 rounded-xl p-4 text-left shadow-xl",
        onClick &&
          "hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-ring/50 cursor-pointer transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
      )}
    >
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", iconClassName)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">{label}</span>
          {onClick && <ChevronRight className="text-muted-foreground ml-auto size-4" />}
        </div>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        <p className={cn("text-xs", extractTextClasses(iconClassName))}>{sublabel}</p>
      </div>
    </Wrapper>
  );
}
