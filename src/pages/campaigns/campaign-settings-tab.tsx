import { type FormEvent, useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Ban, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import type { Channel } from "@/types/domain";

interface CampaignSettingsTabProps {
  canWrite: boolean;
}

/// Frases que, quando um contato responde a um disparo de campanha com uma
/// delas, bloqueiam o contato de futuras campanhas NAQUELA rede social (ver
/// Channel.wordsToBlockCampaign/useWordsToBlockCampaign no schema e
/// Inbound-Service/campaign-response-service.ts, quem avalia a resposta).
/// Edita a lista inteira em memória e salva tudo de uma vez, mesmo padrão do
/// ResetKeywordsDialog (canais > Configuração).
export function CampaignSettingsTab({ canWrite }: CampaignSettingsTabProps) {
  const { data: channels, mutate } = useSWR<Channel[]>("/api/channels");
  const [channelId, setChannelId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channel = channels?.find((c) => c.id === channelId) ?? null;

  useEffect(() => {
    if (!channelId && channels && channels.length > 0) setChannelId(channels[0].id);
  }, [channels, channelId]);

  useEffect(() => {
    if (!channel) return;
    setEnabled(channel.useWordsToBlockCampaign);
    setWords(channel.wordsToBlockCampaign);
    setNewWord("");
    setError(null);
  }, [channel]);

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const value = newWord.trim();
    if (!value) return;
    if (words.some((w) => w.toLowerCase() === value.toLowerCase())) {
      setNewWord("");
      return;
    }
    setWords((prev) => [...prev, value]);
    setNewWord("");
  }

  function handleEdit(index: number, value: string) {
    setWords((prev) => prev.map((w, i) => (i === index ? value : w)));
  }

  function handleRemove(index: number) {
    setWords((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!channel) return;
    setError(null);
    const cleaned = words.map((w) => w.trim()).filter(Boolean);
    setSaving(true);
    try {
      await api.put(`/api/channels/${channel.id}`, {
        wordsToBlockCampaign: cleaned,
        useWordsToBlockCampaign: enabled,
      });
      await mutate();
      toast.success("Configurações de bloqueio de campanha atualizadas.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Ban className="size-5" />
            </div>
            <div>
              <CardTitle>Bloqueio automático por frase</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Quando um contato responde a um disparo de campanha com uma destas frases, ele para de receber
                campanhas desta rede social até você removê-lo manualmente.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Rede social</Label>
            <p className="text-muted-foreground text-xs">Escolha a rede social pra configurar o bloqueio automático de campanha.</p>
            {!channels ? (
              <p className="text-muted-foreground text-xs">Carregando redes sociais...</p>
            ) : channels.length === 0 ? (
              <p className="text-muted-foreground text-xs">Nenhuma rede social cadastrada.</p>
            ) : (
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {channel && (
            <>
              <div className="flex items-center gap-3 border-t pt-4">
                <Switch
                  checked={enabled}
                  disabled={!canWrite || saving}
                  onCheckedChange={setEnabled}
                  className="shrink-0 data-[state=checked]:bg-success"
                />
                <div className="min-w-0 flex-1">
                  <Label>Ativar bloqueio automático</Label>
                  <p className="text-muted-foreground text-xs">
                    Com o switch desligado, as frases abaixo ficam salvas mas não são avaliadas nas respostas dos
                    contatos.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAdd} className="flex items-end gap-2 border-t pt-4">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="block-word-new">Nova frase de bloqueio</Label>
                  <p className="text-muted-foreground text-xs">
                    Quando o contato responder com essa frase exatamente, ele é bloqueado de futuras campanhas nesta
                    rede social.
                  </p>
                  <Input
                    id="block-word-new"
                    placeholder="ex: não quero mais receber mensagens"
                    disabled={!canWrite || saving}
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="outline" disabled={!canWrite || saving || !newWord.trim()}>
                  <Plus className="size-4" /> Adicionar
                </Button>
              </form>

              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                {words.map((word, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input disabled={!canWrite || saving} value={word} onChange={(e) => handleEdit(index, e.target.value)} />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!canWrite || saving}
                      onClick={() => handleRemove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {words.length === 0 && (
                  <p className="text-muted-foreground py-2 text-center text-sm">
                    Nenhuma frase cadastrada para esta rede social ainda.
                  </p>
                )}
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              {canWrite && (
                <Button loading={saving} type="button" disabled={saving} onClick={handleSave} className="w-fit gap-2">
                  <Save className="size-4" /> {saving ? "Salvando…" : "Salvar alterações"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
