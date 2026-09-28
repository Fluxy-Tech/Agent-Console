import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { Building2, Plus, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setActiveCompany } from "@/store/slices/active-company-slice";
import type { Company, Member } from "@/types/domain";

export function BusinessListPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const activeCompanyId = useAppSelector((s) => s.activeCompany?.id);
  const { data: companies, mutate } = useSWR<Company[]>("/api/companies");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const company = await api.post<Company>("/api/companies", { name, cnpj });
      await mutate();
      setDialogOpen(false);
      setName("");
      setCnpj("");
      await handleActivate(company);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a empresa.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRedeem(event: FormEvent) {
    event.preventDefault();
    setInviteError(null);
    setRedeeming(true);
    try {
      const company = await api.post<Company>("/api/companies/redeem-invite", { code });
      await mutate();
      setInviteDialogOpen(false);
      setCode("");
      await handleActivate(company);
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Não foi possível resgatar o código.");
    } finally {
      setRedeeming(false);
    }
  }

  async function handleActivate(company: Company) {
    setActivating(company.id);
    try {
      await api.post("/api/session/active-company", { companyId: company.id });
      const members = await api.get<Member[]>(`/api/companies/${company.id}/members`);
      const membership = members.find((m) => m.userId === user?.id);
      dispatch(
        setActiveCompany({
          id: company.id,
          name: company.name,
          memberRole: membership?.role ?? null,
          memberPermissions: membership?.permissions ?? null,
        }),
      );
      navigate("/targets", { replace: true });
    } finally {
      setActivating(null);
    }
  }

  return (
    <div className="bg-dot-grid min-h-screen p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Empresas</h1>
            <p className="text-muted-foreground mt-1 text-sm">Escolha a empresa que deseja acessar.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Ticket className="size-4" /> Tenho um código de convite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Entrar com código de convite</DialogTitle>
                  <DialogDescription>
                    Digite o código que o gestor da empresa te enviou. Ele só funciona com a conta cadastrada no
                    mesmo e-mail para o qual o código foi gerado.
                  </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4" onSubmit={handleRedeem}>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="invite-code">Código</Label>
                    <Input
                      id="invite-code"
                      required
                      autoFocus
                      placeholder="Ex: 7K3PXQ9M"
                      className="text-center text-lg tracking-[0.3em] uppercase"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  {inviteError && <p className="text-destructive text-sm">{inviteError}</p>}
                  <Button type="submit" disabled={redeeming}>
                    {redeeming ? "Entrando..." : "Entrar na empresa"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Nova empresa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar empresa</DialogTitle>
                  <DialogDescription>Você se torna Gerente da empresa criada.</DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4" onSubmit={handleCreate}>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="company-name">Nome</Label>
                    <Input id="company-name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="company-cnpj">CNPJ</Label>
                    <Input id="company-cnpj" required value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button type="submit" disabled={creating}>
                    {creating ? "Criando..." : "Criar e acessar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {companies?.map((company) => (
            <Card key={company.id} className={cn("shadow-xl", company.id === activeCompanyId && "border-primary")}>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{company.name}</CardTitle>
                  <p className="text-muted-foreground text-xs">{company.cnpj}</p>
                </div>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button
                  size="sm"
                  variant={company.id === activeCompanyId ? "outline" : "default"}
                  disabled={activating === company.id}
                  onClick={() => handleActivate(company)}
                >
                  {company.id === activeCompanyId ? "Ativa" : "Acessar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/business/${company.id}`)}>
                  Gerenciar acessos
                </Button>
              </CardContent>
            </Card>
          ))}
          {companies && companies.length === 0 && (
            <p className="text-muted-foreground col-span-2 text-sm">
              Você ainda não faz parte de nenhuma empresa. Crie uma nova ou entre com um código de convite.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
