import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Channel } from "@/types/domain";

const DEFAULT_RESET_MESSAGE =
  "Prontinho! Reiniciei nossa conversa e apaguei os dados que eu tinha guardado sobre você. Pode começar de novo quando quiser.";

interface ResetKeywordsDialogProps {
  channel: Channel;
  disabled: boolean;
  onSaved: () => void;
  trigger: React.ReactNode;
}

/// Modal "Palavras-chave para reset de jornada" — lista livre de
/// palavras/frases que, ditas pelo contato, fazem o worker apagar o
/// histórico de sessão e os metadados salvos dele (ver
/// Channel.wordsToReset no schema e AI-Worker/Piloto/consumer.py).
/// Edita a lista inteira em memória e salva tudo de uma vez no PUT do canal.
export function ResetKeywordsDialog({ channel, disabled, onSaved, trigger }: ResetKeywordsDialogProps) {
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState<string[]>(channel.wordsToReset);
  const [newWord, setNewWord] = useState("");
  const [resetMessage, setResetMessage] = useState(channel.resetMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setWords(channel.wordsToReset);
      setNewWord("");
      setResetMessage(channel.resetMessage ?? "");
      setError(null);
    }
  }, [open, channel]);

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
    setError(null);
    const cleaned = words.map((w) => w.trim()).filter(Boolean);
    setSaving(true);
    try {
      await api.put(`/api/channels/${channel.id}`, { wordsToReset: cleaned, resetMessage: resetMessage.trim() });
      onSaved();
      toast.success("Palavras-chave de reset atualizadas.");
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <DialogTitle>Palavras-chave para reset de jornada</DialogTitle>
              <DialogDescription>
                Quando o contato manda uma mensagem igual a uma destas palavras/frases, o agente de IA apaga o
                histórico da conversa e os dados que já tinha salvo dele, e recomeça o atendimento do zero.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <form onSubmit={handleAdd} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="reset-keyword-new">Nova palavra-chave</Label>
              <Input
                id="reset-keyword-new"
                placeholder="ex: reiniciar"
                disabled={disabled || saving}
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" disabled={disabled || saving || !newWord.trim()}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </form>

          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {words.map((word, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  disabled={disabled || saving}
                  value={word}
                  onChange={(e) => handleEdit(index, e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={disabled || saving}
                  onClick={() => handleRemove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {words.length === 0 && (
              <p className="text-muted-foreground py-2 text-center text-sm">
                Nenhuma palavra-chave cadastrada. O reset de jornada fica desativado para este canal.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 border-t pt-3">
            <Label htmlFor="reset-message">Mensagem enviada após o reset</Label>
            <p className="text-muted-foreground text-xs">Deixe em branco para usar a mensagem padrão abaixo.</p>
            <Textarea
              id="reset-message"
              rows={3}
              placeholder={DEFAULT_RESET_MESSAGE}
              disabled={disabled || saving}
              value={resetMessage}
              onChange={(e) => setResetMessage(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {!disabled && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saving} type="button" disabled={saving} onClick={handleSave}>
              <Save className="size-4" /> {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
