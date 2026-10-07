import { useNavigate } from "react-router-dom";
import { Bot, Building2, CalendarDays, Eye, Hash, Headset, IdCard, KeyRound, type LucideIcon, Pencil, Phone, RotateCcw, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Channel } from "@/types/domain";
import { AgentPicker } from "./agent-picker-dialog";
import { ChannelDataDialog } from "./channel-data-dialog";
import { ResetKeywordsDialog } from "./reset-keywords-dialog";

interface ConfigTabProps {
  channel: Channel;
  canWrite: boolean;
  onSaved: () => void;
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="border-border flex items-center gap-3 rounded-lg border p-3 shadow-xl">
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function ConfigTab({ channel, canWrite, onSaved }: ConfigTabProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Bot className="size-5" />
            </div>
            <div>
              <CardTitle>Agentes</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Ative ou pause o atendimento automático deste canal e escolha o agente de IA responsável por ele.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AgentPicker channel={channel} disabled={!canWrite} onSaved={onSaved} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <IdCard className="size-5" />
              </div>
              <div>
                <CardTitle>Dados do canal</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  Identificadores do número na Meta e o token de acesso usado pra falar com a Graph API.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={Hash} label="Phone Number ID" value={channel.phoneNumberId} />
              <InfoRow icon={Phone} label="Número de exibição" value={channel.displayNumber} />
              <InfoRow icon={Building2} label="Id do Waba" value={channel.wabaId} />
              <InfoRow icon={KeyRound} label="Token de acesso da Meta" value={channel.metaAccessTokenPreview ?? "Não configurado"} />
            </div>
            <ChannelDataDialog
              channel={channel}
              disabled={!canWrite}
              onSaved={onSaved}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className="border-primary/40 text-primary bg-primary/10 hover:bg-primary/15 w-full border-dashed"
                  disabled={!canWrite}
                >
                  <Pencil className="size-4" /> Editar dados
                </Button>
              }
            />
          </CardContent>
        </Card>

        {channel.serviceIsland && (
          <Card className="h-auto shadow-xl self-start">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Headset className="size-5" />
                </div>
                <div>
                  <CardTitle>Ilha de atendimento</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Fila de atendimento humano vinculada a este canal quando o agente de IA está desativado.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <InfoRow icon={Tag} label="Nome da ilha" value={channel.serviceIsland.name} />
                <InfoRow
                  icon={CalendarDays}
                  label="Criada em"
                  value={new Date(channel.serviceIsland.createdAt).toLocaleDateString("pt-BR")}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-success text-success bg-success/10 hover:bg-success/15 w-full border-dashed"
                onClick={() => navigate(`/service-island/${channel.serviceIsland!.id}`)}
              >
                <Eye className="size-4" /> Ver ilha de atendimento
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <RotateCcw className="size-5" />
              </div>
              <div>
                <CardTitle>Palavras-chave para reset de jornada</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  Se o contato mandar uma mensagem igual a uma destas palavras, o agente apaga o histórico da
                  conversa e os dados salvos dele, recomeçando o atendimento do zero.
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResetKeywordsDialog
            channel={channel}
            disabled={!canWrite}
            onSaved={onSaved}
            trigger={
              <Button type="button" variant="outline" className="border-primary/40 text-primary bg-primary/10 hover:bg-primary/15 w-full border-dashed" disabled={!canWrite}>
                <Pencil className="size-4" /> Gerenciar palavras-chave
                {channel.wordsToReset.length > 0 ? ` (${channel.wordsToReset.length})` : ""}
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
