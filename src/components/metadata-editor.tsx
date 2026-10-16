import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MetadataRow {
  key: string;
  value: string;
}

function toRows(metadata: Record<string, unknown> | null): MetadataRow[] {
  return Object.entries(metadata ?? {}).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

interface MetadataEditorProps {
  metadata: Record<string, unknown> | null;
  saving: boolean;
  onSave: (metadata: Record<string, string>) => Promise<void>;
}

/// Edição das linhas chave:valor do metadata do contato — inserir, alterar e
/// excluir, sempre salvando o objeto inteiro (ver target-service.ts#updateMetadata).
/// Diferente de MetadataView (leitura, com suporte a valores aninhados), aqui
/// todo valor é tratado como texto — cobre o caso de uso do CRM (ex: "origem",
/// "orçamento").
export function MetadataEditor({ metadata, saving, onSave }: MetadataEditorProps) {
  const [rows, setRows] = useState<MetadataRow[]>(() => toRows(metadata));

  useEffect(() => {
    setRows(toRows(metadata));
  }, [metadata]);

  function updateRow(index: number, patch: Partial<MetadataRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [...prev, { key: "", value: "" }]);
  }

  async function handleSave() {
    const entries = rows.map((row) => [row.key.trim(), row.value] as const).filter(([key]) => key.length > 0);
    await onSave(Object.fromEntries(entries));
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && <p className="text-muted-foreground text-sm">Nenhum metadado registrado ainda.</p>}

      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            placeholder="Chave"
            value={row.key}
            onChange={(e) => updateRow(index, { key: e.target.value })}
            className="flex-1"
          />
          <Input
            placeholder="Valor"
            value={row.value}
            onChange={(e) => updateRow(index, { value: e.target.value })}
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(index)}>
            <Trash2 className="text-destructive size-4" />
          </Button>
        </div>
      ))}

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" /> Adicionar
        </Button>
        <Button loading={saving} type="button" size="sm" disabled={saving} onClick={handleSave}>
          <Save className="size-4" /> {saving ? "Salvando…" : "Salvar metadados"}
        </Button>
      </div>
    </div>
  );
}
