import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { Channel } from "@/types/domain";

interface ChannelDataDialogProps {
  channel: Channel;
  disabled: boolean;
  onSaved: () => void;
  trigger: React.ReactNode;
}

/// Modal "Dados do canal" — Phone Number ID, Número de exibição e WABA ID
/// lado a lado (mesma linha), token de acesso da Meta abaixo. Salva só esses
/// 4 campos (o agente é trocado à parte, pelo modal "Agentes").
export function ChannelDataDialog({ channel, disabled, onSaved, trigger }: ChannelDataDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phoneNumberId: "", displayNumber: "", wabaId: "" });
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ phoneNumberId: channel.phoneNumberId, displayNumber: channel.displayNumber, wabaId: channel.wabaId });
      setMetaAccessToken("");
      setError(null);
    }
  }, [open, channel]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Campo em branco = não mexe no token já salvo — só envia se o usuário
      // digitou um novo.
      await api.put(`/api/channels/${channel.id}`, metaAccessToken ? { ...form, metaAccessToken } : form);
      onSaved();
      toast.success("Dados do canal atualizados.");
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dados do canal</DialogTitle>
          <DialogDescription>Identificadores do número na Meta e o token de acesso usado pra falar com a Graph API.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wc-phone-number-id">Phone Number ID</Label>
              <Input
                id="wc-phone-number-id"
                disabled={disabled || saving}
                value={form.phoneNumberId}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumberId: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wc-display-number">Número de exibição</Label>
              <Input
                id="wc-display-number"
                disabled={disabled || saving}
                value={form.displayNumber}
                onChange={(e) => setForm((f) => ({ ...f, displayNumber: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wc-waba-id">Id do Waba</Label>
              <Input
                id="wc-waba-id"
                disabled={disabled || saving}
                value={form.wabaId}
                onChange={(e) => setForm((f) => ({ ...f, wabaId: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wc-meta-access-token">Token de acesso da Meta</Label>
            <p className="text-muted-foreground text-xs">Deixe em branco para manter o token atual. Preencha só se quiser trocá-lo.</p>
            <Input
              id="wc-meta-access-token"
              type="password"
              disabled={disabled || saving}
              placeholder={channel.metaAccessTokenPreview ?? "Nenhum token configurado"}
              value={metaAccessToken}
              onChange={(e) => setMetaAccessToken(e.target.value)}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          {!disabled && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button loading={saving} type="submit" disabled={saving}>
                <Save className="size-4" /> {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
