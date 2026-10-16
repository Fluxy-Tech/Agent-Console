import { MessageSquareDashed, MessageSquareText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AgentFormTabProps } from "./agent-form-types";

/// Campo de mensagem obrigatório, sem toggle de desativação (regra do
/// EscopoSaas: processando / transbordo / formato não suportado).
function RequiredMessageField(props: {
  label: string;
  helper: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-bold">
        {props.label} <span className="text-destructive">*</span>
      </Label>
      <p className="text-muted-foreground text-xs">{props.helper}</p>
      <Textarea
        required
        className="min-h-24"
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

/// Campo de mensagem com switch — quando desativado, a IA responde livremente
/// nesse cenário (aviso explícito, regra do EscopoSaas).
function ToggleableMessageField(props: {
  label: string;
  helper: string;
  value: string;
  enabled: boolean;
  onChangeValue: (value: string) => void;
  onChangeEnabled: (enabled: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Switch
          checked={props.enabled}
          onCheckedChange={props.onChangeEnabled}
          disabled={props.disabled}
          className="data-[state=checked]:bg-[#25D366]"
        />
        <span className="text-muted-foreground text-xs">{props.enabled ? "Ativado" : "Desativado"}</span>
      </div>
      <Label className="font-bold">{props.label}</Label>
      <p className="text-muted-foreground text-xs">{props.helper}</p>
      <Textarea
        className="min-h-24"
        value={props.value}
        disabled={props.disabled || !props.enabled}
        onChange={(e) => props.onChangeValue(e.target.value)}
      />
      {!props.enabled && (
        <p className="text-warning text-xs">
          Desativado: a Inteligência Artificial pode gerar qualquer resposta neste cenário.
        </p>
      )}
    </div>
  );
}

export function MessagesTab({ form, set, disabled }: AgentFormTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <MessageSquareText className="size-5" />
            </div>
            <div>
              <CardTitle>Mensagens obrigatórias</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Sempre têm um texto configurado e são enviadas automaticamente pelo agente, sem opção de desativar.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <RequiredMessageField
            label="Mensagem de processando"
            helper="Enviada enquanto o agente está pensando na resposta."
            value={form.processingMessage}
            onChange={(v) => set("processingMessage", v)}
            disabled={disabled}
          />
          <RequiredMessageField
            label="Mensagem de transbordo ao atendimento humano"
            helper="Enviada uma única vez, quando o ticket é criado para um atendente."
            value={form.transferMessage}
            onChange={(v) => set("transferMessage", v)}
            disabled={disabled}
          />
          <RequiredMessageField
            label="Mensagem de formato não suportado"
            helper="Enviada quando o cliente manda um tipo de mensagem que o agente não processa."
            value={form.unsupportedFormatMessage}
            onChange={(v) => set("unsupportedFormatMessage", v)}
            disabled={disabled}
          />
          <RequiredMessageField
            label="Mensagem para números bloqueados"
            helper="Enviada no lugar da IA/atendente quando o contato está bloqueado para este agente."
            value={form.blockedMessage}
            onChange={(v) => set("blockedMessage", v)}
            disabled={disabled}
          />
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <MessageSquareDashed className="size-5" />
            </div>
            <div>
              <CardTitle>Mensagens opcionais</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Cada uma tem um switch: quando desativada, a IA responde livremente nesse cenário.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ToggleableMessageField
            label="Mensagem de fora de horário de atendimento humano"
            helper="Enviada quando o cliente tenta falar com um atendente fora do horário de atendimento configurado."
            value={form.outOfHoursMessage}
            enabled={form.outOfHoursEnabled}
            onChangeValue={(v) => set("outOfHoursMessage", v)}
            onChangeEnabled={(v) => set("outOfHoursEnabled", v)}
            disabled={disabled}
          />
          <ToggleableMessageField
            label="Mensagem de finalização"
            helper="Enviada quando o atendimento é encerrado com sucesso."
            value={form.closingMessage}
            enabled={form.closingEnabled}
            onChangeValue={(v) => set("closingMessage", v)}
            onChangeEnabled={(v) => set("closingEnabled", v)}
            disabled={disabled}
          />
          <ToggleableMessageField
            label="Mensagem de erro"
            helper="Enviada quando algo dá errado ao processar a mensagem do cliente."
            value={form.errorMessage}
            enabled={form.errorEnabled}
            onChangeValue={(v) => set("errorMessage", v)}
            onChangeEnabled={(v) => set("errorEnabled", v)}
            disabled={disabled}
          />
        </CardContent>
      </Card>
    </div>
  );
}
