import type { ReactNode } from "react";
import { Bot, MessageSquare, ShieldCheck, Zap } from "lucide-react";
import sturnusWordmark from "@/assets/NomeSemFundo.png";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Bot, text: "Agentes de IA que atendem seus clientes 24 horas por dia" },
  { icon: MessageSquare, text: "Direto no WhatsApp, sem app novo pra ninguém aprender" },
  { icon: Zap, text: "Handoff instantâneo pra um atendente humano quando precisar" },
  { icon: ShieldCheck, text: "Conversas e dados isolados por empresa, com controle de acesso" },
];

/// Split-screen: painel de marca degradê roxo à esquerda (headline + destaques
/// do produto) e o card de entrar/cadastrar (children) centralizado à
/// direita. Em telas pequenas o painel de marca some e sobra só o card, com
/// a logo pequena acima dele.
interface AuthLayoutProps {
  children: ReactNode;
  /** As páginas cujo card já mostra a logo (signin/signup) não precisam do
   * cabeçalho de logo mobile duplicado aqui. */
  hideMobileLogo?: boolean;
  /** Foto no lugar do degradê azul do painel de marca (login/cadastro). */
  backgroundImage?: string;
}

export function AuthLayout({ children, hideMobileLogo, backgroundImage }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <div
        className={cn(
          "relative hidden overflow-hidden lg:flex lg:w-1/2 lg:flex-col lg:p-12",
          backgroundImage ? "bg-cover bg-center lg:justify-end" : "lg:justify-between",
          !backgroundImage && "from-primary via-primary to-primary/70 bg-gradient-to-br",
        )}
        style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
      >
        {backgroundImage ? (
          // Escurece e desfoca a foto (e mantém o copyright branco legível).
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/70 backdrop-blur-[2px]" />
        ) : (
          <>
            <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 bottom-0 size-[28rem] rounded-full bg-white/10 blur-3xl" />
            <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-[0.07]" />
          </>
        )}

        {/* Com foto (login/cadastro) o painel fica só com a imagem e o copyright. */}
        {!backgroundImage && (
          <div className="relative flex flex-col gap-8">
            <h1 className="font-[family-name:var(--font-display)] max-w-md text-4xl leading-tight font-semibold text-white">
              Atendimento no WhatsApp, potencializado por IA.
            </h1>
            <ul className="flex flex-col gap-4">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                    <Icon className="size-4" />
                  </span>
                  <span className="mt-1 text-sm text-white/90">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} Sturnus Flow</p>
      </div>

      <div className="bg-dot-grid flex flex-1 flex-col items-center justify-center gap-6 p-4">
        {!hideMobileLogo && (
          <div className="flex items-center gap-2 lg:hidden">
            <img src={sturnusWordmark} alt="Sturnus Flow" className="h-9 w-auto" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
