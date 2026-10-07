import { type FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { AgentMetadataField } from "@/types/domain";

/// Prévia da chave que a API vai gerar (mesma regra de
/// Agent-Api/src/domain/utils/metadata-key.ts) — só pra exibição, quem grava
/// nameToAgent de verdade é o backend.
function previewMetadataKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

interface MetadataFieldFormDialogProps {
  agentId: string;
  field?: AgentMetadataField;
  onSaved: () => void;
  trigger: React.ReactNode;
}

export function MetadataFieldFormDialog({ agentId, field, onSaved, trigger }: MetadataFieldFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rule, setRule] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(field?.name ?? "");
    setRule(field?.rule ?? "");
    setActive(field?.active ?? true);
    setError(null);
  }, [open, field]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // O Dialog é renderizado em portal, mas o evento de submit do React ainda
    // sobe pela árvore até o <form> da página do agente — sem isso, salvar o
    // metadado também dispararia "Salvar alterações" do agente.
    event.stopPropagation();
    setError(null);
    setSaving(true);
    try {
      const body = { name, rule, active };
      if (field) {
        await api.put(`/api/agents/${agentId}/metadata-fields/${field.id}`, body);
      } else {
        await api.post(`/api/agents/${agentId}/metadata-fields`, body);
      }

      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o metadado.");
    } finally {
      setSaving(false);
    }
  }

  const keyPreview = previewMetadataKey(name);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{field ? "Editar metadado" : "Novo metadado"}</DialogTitle>
          <DialogDescription>
            Informe qual dado o agente deve coletar do contato e a regra de como perguntar. O valor coletado fica
            salvo nos metadados do contato.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="metadata-field-name" className="font-bold">
              Nome do metadado
            </Label>
            <p className="text-muted-foreground text-xs">Como esse dado aparece para você. Ex: Cidade de interesse.</p>
            <Input
              id="metadata-field-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Chave usada pelo agente:{" "}
              <code className="bg-muted rounded-sm px-1 py-0.5 font-mono">{keyPreview || "—"}</code>
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="metadata-field-rule" className="font-bold">
              Regra de coleta
            </Label>
            <p className="text-muted-foreground text-xs">
              Explique como o agente deve perguntar e validar esse dado. Ex: Pergunte em qual cidade o contato quer o
              serviço; aceite só cidades do Brasil.
            </p>
            <Textarea id="metadata-field-rule" required value={rule} onChange={(e) => setRule(e.target.value)} />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={active}
              onCheckedChange={setActive}
              className="data-[state=checked]:bg-[#25D366]"
            />
            <div>
              <Label className="font-bold">Coletar este dado</Label>
              <p className="text-muted-foreground text-xs">Desativado, o agente para de perguntar, mas o cadastro fica salvo.</p>
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" disabled={saving || !keyPreview}>
            <Save className="size-4" /> {saving ? "Salvando…" : field ? "Salvar alterações" : "Criar metadado"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
