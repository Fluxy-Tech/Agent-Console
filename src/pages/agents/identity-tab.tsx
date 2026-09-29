import { FileUser, Link, Lock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import geminiLogo from "@/assets/LogoGermini.png";
import openaiLogo from "@/assets/LogoOpenAi.png";
import type { AgentFormTabProps } from "./agent-form-types";
import { MetadataFieldsCard } from "./metadata-fields-card";

interface IdentityTabProps extends AgentFormTabProps {
  agentId: string | undefined;
  canWrite: boolean;
  openaiToken: string;
  onChangeOpenaiToken: (value: string) => void;
  openaiTokenPreview: string | null;
  geminiToken: string;
  onChangeGeminiToken: (value: string) => void;
  geminiTokenPreview: string | null;
}

export function IdentityTab({
  form,
  set,
  disabled,
  agentId,
  canWrite,
  openaiToken,
  onChangeOpenaiToken,
  openaiTokenPreview,
  geminiToken,
  onChangeGeminiToken,
  geminiTokenPreview,
}: IdentityTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <FileUser className="size-5" />
            </div>
            <div>
              <CardTitle>Identidade do agente</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Defina o nome, o status e a personalidade que moldam como o agente se apresenta e se comunica.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* 1º Agente ativo */}
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => set("isActive", v)}
              disabled={disabled}
              className="data-[state=checked]:bg-[#25D366] data-[state=unchecked]:bg-destructive"
            />
            <div>
              <Label className="font-bold">Agente ativo</Label>
              <p className="text-muted-foreground text-xs">O agente está disponível para atender os usuários.</p>
            </div>
          </div>

          {/* 2º Nome do agente */}
          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="agent-name" className="font-bold">
              Nome do agente
            </Label>
            <p className="text-muted-foreground text-xs">
              Lembrando que o nome deve ser exatamente igual ao que o desenvolvedor orientou.
            </p>
            <Input
              id="agent-name"
              required
              disabled={disabled}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          {/* 3º Personalidade */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-personality" className="font-bold">
              Personalidade do seu agente
            </Label>
            <p className="text-muted-foreground text-xs">
              Defina como o agente deve se comunicar, seu tom de voz e comportamento.
            </p>
            <Textarea
              id="agent-personality"
              disabled={disabled}
              value={form.personality}
              onChange={(e) => set("personality", e.target.value)}
            />
            <p className="text-muted-foreground self-end text-xs">{form.personality.length} caracteres</p>
          </div>
        </CardContent>
      </Card>

      <MetadataFieldsCard agentId={agentId} canWrite={canWrite} />

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Link className="size-5" />
            </div>
            <div>
              <CardTitle>Modelos e integrações</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Configure as credenciais dos provedores de IA que serão utilizados pelo agente.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="border-border bg-primary/5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={openaiLogo} alt="OpenAI" className="size-10 shrink-0 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold">OpenAI · RAG</p>
                <p className="text-muted-foreground text-xs">Modelo principal para geração de respostas.</p>
              </div>
            </div>
            <div className="relative w-full sm:w-96">
              <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
              <Input
                id="agent-openai-token"
                type="password"
                disabled={disabled}
                className="pl-8"
                placeholder={
                  openaiTokenPreview ? `${openaiTokenPreview}•••••••• — digite para trocar` : "Nenhum token configurado"
                }
                value={openaiToken}
                onChange={(e) => onChangeOpenaiToken(e.target.value)}
              />
            </div>
          </div>

          <div className="border-border bg-primary/5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={geminiLogo} alt="Gemini" className="size-10 shrink-0 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold">Gemini · ADK</p>
                <p className="text-muted-foreground text-xs">Utilizado para operações de busca e ações.</p>
              </div>
            </div>
            <div className="relative w-full sm:w-96">
              <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
              <Input
                id="agent-gemini-token"
                type="password"
                disabled={disabled}
                className="pl-8"
                placeholder={
                  geminiTokenPreview ? `${geminiTokenPreview}•••••••• — digite para trocar` : "Nenhum token configurado"
                }
                value={geminiToken}
                onChange={(e) => onChangeGeminiToken(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-start gap-2 border-t pt-4">
            <ShieldCheck className="text-primary size-4 shrink-0" />
            <p className="text-muted-foreground text-xs">
              Guardados de forma criptografada — por segurança, nunca mostramos o token completo aqui, só os 6
              primeiros caracteres do que já está salvo.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
