import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { CircleHelp, Link2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { HELP_SECTIONS } from "./help-sections";

/// Tela "Dúvidas": cada seção tem um id (âncora). Outras telas apontam pra
/// /duvidas#<id> e a página rola até a seção e a destaca.
export function HelpPage() {
  const { hash } = useLocation();
  const target = decodeURIComponent(hash.replace(/^#/, ""));
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    // O conteúdo rola dentro do <main> do AppShell, não na janela —
    // scrollIntoView acha o contêiner certo sozinho.
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlighted(target);
    const timer = setTimeout(() => setHighlighted(null), 2000);
    return () => clearTimeout(timer);
  }, [target]);

  async function copyLink(id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/duvidas#${id}`);
      toast.success("Link da seção copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Dúvidas" }]} />

      <div className="flex items-start gap-3">
        <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
          <CircleHelp className="size-5" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Dúvidas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Explicações sobre o funcionamento da plataforma. Escolha um assunto ou role a página.
          </p>
        </div>
      </div>

      <nav aria-label="Assuntos" className="flex flex-wrap gap-2">
        {HELP_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.id} to={{ hash: section.id }} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Icon className="size-4" /> {section.title}
            </Link>
          );
        })}
      </nav>

      {HELP_SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <Card
            key={section.id}
            id={section.id}
            className={cn("scroll-mt-6 shadow-xl transition-shadow duration-500", highlighted === section.id && "ring-primary ring-2")}
          >
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-5" />
                </div>
                <div className="flex-1">
                  <CardTitle>{section.title}</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">{section.summary}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => copyLink(section.id)} aria-label="Copiar link da seção">
                  <Link2 className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {section.content}
              {section.questions.length > 0 && (
                <Accordion type="multiple" className="border-border rounded-lg border px-4">
                  {section.questions.map((q, i) => (
                    <AccordionItem key={q.question} value={`${section.id}-${i}`} className={cn(i > 0 && "border-border border-t")}>
                      <AccordionTrigger>{q.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">{q.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
