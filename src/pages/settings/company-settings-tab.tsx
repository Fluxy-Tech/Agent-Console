import { type FormEvent, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { ImageUploadField, uploadImage } from "@/components/image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setActiveCompany } from "@/store/slices/active-company-slice";
import type { Company } from "@/types/domain";
import { useImageDraft } from "./use-image-draft";

export function CompanySettingsTab({ companyId }: { companyId: string }) {
  const { data: company, mutate } = useSWR<Company>(`/api/companies/${companyId}`);

  if (!company) return <p className="text-muted-foreground text-sm">Carregando…</p>;

  // key: troca de empresa ativa remonta o formulário com os dados da nova.
  return <CompanyForm key={company.id} company={company} onSaved={(updated) => mutate(updated, { revalidate: false })} />;
}

function CompanyForm({ company, onSaved }: { company: Company; onSaved: (company: Company) => void }) {
  const dispatch = useAppDispatch();
  const activeCompany = useAppSelector((s) => s.activeCompany);
  const [name, setName] = useState(company.name);
  const [cnpj, setCnpj] = useState(company.cnpj);
  const [saving, setSaving] = useState(false);
  const logo = useImageDraft(company.logoUrl ?? null);

  const dirty = name.trim() !== company.name || cnpj.trim() !== company.cnpj || logo.dirty;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (cnpj.replace(/\D/g, "").length !== 14) {
      toast.error("CNPJ precisa ter 14 dígitos.");
      return;
    }
    setSaving(true);
    try {
      const logoKey = await logo.resolve((file) =>
        uploadImage((input) => api.post(`/api/companies/${company.id}/logo/presign`, input), file),
      );
      const updated = await api.put<Company>(`/api/companies/${company.id}`, {
        name: name.trim(),
        cnpj: cnpj.trim(),
        logo: logoKey,
      });
      onSaved(updated);
      logo.reset();
      setName(updated.name);
      setCnpj(updated.cnpj);
      // O nome da empresa ativa aparece no menu do usuário.
      if (activeCompany?.id === updated.id) dispatch(setActiveCompany({ ...activeCompany, name: updated.name }));
      toast.success("Dados da empresa atualizados.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a empresa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Building2 className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">Empresa</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">Nome, CNPJ e logo da empresa.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-5">
          <ImageUploadField
            previewUrl={logo.previewUrl}
            fallback={<Building2 className="size-8" />}
            disabled={saving}
            onSelect={(file) => {
              const error = logo.select(file);
              if (error) toast.error(error);
            }}
            onRemove={logo.remove}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company-name">Nome da empresa</Label>
            <Input id="company-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company-cnpj">CNPJ</Label>
            <Input
              id="company-cnpj"
              required
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
            />
          </div>
          <div>
            <Button type="submit" disabled={saving || !dirty || !name.trim() || !cnpj.trim()}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
