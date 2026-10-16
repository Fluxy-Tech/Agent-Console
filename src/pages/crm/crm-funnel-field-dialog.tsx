import { type FormEvent, type ReactNode, useState } from "react";
import useSWR from "swr";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { api, ApiError } from "@/lib/api";
import type { CrmFunnelField } from "@/types/domain";

interface CrmFunnelFieldDialogProps {
  /// Sem `field` o dialog cria uma etapa nova; com, edita a existente.
  field?: CrmFunnelField;
  onSaved: () => void;
  trigger: ReactNode;
}

/// Dialog de criar/editar etapa do funil — nome da chave do metadata e, se
/// "Comparar com valor específico" estiver marcado, o valor esperado.
export function CrmFunnelFieldDialog({ field, onSaved, trigger }: CrmFunnelFieldDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [useValue, setUseValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sugestões de chaves já usadas pelos contatos da empresa — o campo aceita
  // qualquer nome mesmo assim (a chave pode ainda não existir em ninguém).
  const { data: metadataKeys } = useSWR<string[]>(open ? "/api/targets/metadata-keys" : null);

  const isEdit = Boolean(field);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(field?.name ?? "");
      setValue(field?.value ?? "");
      setUseValue(field?.useValue ?? false);
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = { name, value: useValue ? value : null, useValue };
      if (field) {
        await api.patch(`/api/crm/funnel/fields/${field.id}`, body);
      } else {
        await api.post("/api/crm/funnel/fields", body);
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a etapa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar etapa" : "Nova etapa"}</DialogTitle>
          <DialogDescription>
            Informe o nome do campo nos metadados do contato que indica a conversão desta etapa.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="funnel-field-name">Nome do campo</Label>
            <Input
              id="funnel-field-name"
              required
              list="funnel-field-name-options"
              placeholder="ex.: condicoes_de_pagar_parcelas_remanescentes"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <datalist id="funnel-field-name-options">
              {metadataKeys?.map((key) => <option key={key} value={key} />)}
            </datalist>
          </div>

          <label className="flex items-start gap-2.5">
            <Checkbox className="mt-0.5" checked={useValue} onCheckedChange={(v) => setUseValue(v === true)} />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Comparar com valor específico</span>
              <span className="text-muted-foreground text-xs">
                Desmarcado, conta todo contato que tem este campo preenchido.
              </span>
            </span>
          </label>

          {useValue && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="funnel-field-value">Valor esperado</Label>
              <Input id="funnel-field-value" required value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button loading={saving} type="submit" disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando…" : isEdit ? "Salvar etapa" : "Criar etapa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
