import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type { SupportSeverity, SupportTeamMember } from "@/types/domain";
import { SEVERITIES, SEVERITY_INFO } from "./support-config";

/// Três "chips" S1/S2/S3 que ligam/desligam cada classificação. Nunca deixa
/// desmarcar a última (a API exige ao menos uma).
function SeverityToggles({
  value,
  onChange,
  disabled,
}: {
  value: SupportSeverity[];
  onChange?: (next: SupportSeverity[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Classificações atendidas">
      {SEVERITIES.map((key) => {
        const active = value.includes(key);
        const isLast = active && value.length === 1;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            disabled={disabled || !onChange || isLast}
            title={isLast ? "Ao menos uma classificação" : SEVERITY_INFO[key].summary}
            onClick={() => onChange?.(active ? value.filter((item) => item !== key) : [...value, key])}
            className={cn(
              "rounded-sm border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:cursor-not-allowed",
              active
                ? cn(SEVERITY_INFO[key].accentClassName, "text-foreground")
                : "border-border text-muted-foreground hover:bg-accent",
              disabled && "opacity-60",
            )}
          >
            {SEVERITY_INFO[key].label} · {SEVERITY_INFO[key].name}
          </button>
        );
      })}
    </div>
  );
}

/// "Time de suporte" (/support/team) — onde (e SÓ onde) se dá ou tira a flag
/// de suporte (User.role "support") de uma conta. Só Administradores: o item
/// do menu fica escondido pros demais e a API responde 403. A tela de Acessos
/// continua só com os papéis por empresa.
export function SupportTeamPage() {
  const isPlatformAdmin = useAppSelector((state) => state.auth.user?.isPlatformAdmin ?? false);
  const { data: team, mutate } = useSWR<SupportTeamMember[]>(isPlatformAdmin ? "/api/support/team" : null);

  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Classificações de quem vai entrar no time — padrão: todas.
  const [newSeverities, setNewSeverities] = useState<SupportSeverity[]>([...SEVERITIES]);
  const [savingSeveritiesId, setSavingSeveritiesId] = useState<string | null>(null);

  async function handleSeveritiesChange(member: SupportTeamMember, severities: SupportSeverity[]) {
    setSavingSeveritiesId(member.id);
    // Otimista: o chip muda na hora; se a API recusar, volta.
    await mutate(
      (current) => current?.map((item) => (item.id === member.id ? { ...item, severities } : item)),
      { revalidate: false },
    );
    try {
      await api.put(`/api/support/team/${member.id}/severities`, { severities });
      toast.success(`Classificações de ${member.name} atualizadas.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar as classificações.");
    } finally {
      setSavingSeveritiesId(null);
      await mutate();
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const member = await api.post<SupportTeamMember>("/api/support/team", { email, severities: newSeverities });
      toast.success(`${member.name} agora faz parte do time de suporte.`);
      setEmail("");
      setNewSeverities([...SEVERITIES]);
      await mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível adicionar ao time de suporte.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(member: SupportTeamMember) {
    setRemovingId(member.id);
    try {
      await api.delete(`/api/support/team/${member.id}`);
      toast.success(`${member.name} saiu do time de suporte.`);
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível remover do time de suporte.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Suporte técnico", to: "/support" }, { label: "Time de suporte" }]} />

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Time de suporte</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Quem tem a flag de suporte vê e responde os tickets de todas as empresas e acessa a central Suporte
          Sturnus — sem acesso às demais telas das empresas.
        </p>
      </div>

      {!isPlatformAdmin ? (
        <Card className="p-6 shadow-xl">
          <p className="text-muted-foreground text-sm">Apenas Administradores gerenciam o time de suporte.</p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card className="h-fit shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="text-primary size-4" /> Adicionar ao time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="support-member-email">E-mail do usuário</Label>
                  <Input
                    id="support-member-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="pessoa@empresa.com"
                    disabled={adding}
                  />
                  <p className="text-muted-foreground text-xs">
                    Só é possível adicionar quem já tem conta na plataforma — o e-mail é conferido antes.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Classificações que vai atender</Label>
                  <SeverityToggles value={newSeverities} onChange={setNewSeverities} disabled={adding} />
                  <p className="text-muted-foreground text-xs">
                    A pessoa só vê, recebe aviso e responde tickets dessas classificações.
                  </p>
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button type="submit" disabled={adding || !email.trim()}>
                  {adding ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  Adicionar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="text-primary size-4" /> Membros
                {team && <span className="text-muted-foreground text-sm font-normal">({team.length})</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!team ? (
                <p className="text-muted-foreground py-6 text-center text-sm">Carregando…</p>
              ) : (
                <ul className="border-border divide-border divide-y rounded-lg border">
                  {team.map((member) => (
                    <li key={member.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="text-muted-foreground truncate text-xs">{member.email}</p>
                        <div className="mt-2">
                          {member.role === "admin" ? (
                            <p className="text-muted-foreground text-xs">Atende todas as classificações.</p>
                          ) : (
                            <SeverityToggles
                              value={member.severities}
                              disabled={savingSeveritiesId === member.id}
                              onChange={(severities) => void handleSeveritiesChange(member, severities)}
                            />
                          )}
                        </div>
                      </div>
                      {member.role === "admin" ? (
                        <Badge variant="default" className="shrink-0 gap-1">
                          <ShieldCheck className="size-3" /> Administrador
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          Suporte
                        </Badge>
                      )}
                      {member.locked && (
                        <Lock
                          className="text-muted-foreground size-4 shrink-0"
                          aria-label="Fixo pela configuração da plataforma"
                        />
                      )}
                      {member.removable && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                              disabled={removingId === member.id}
                              aria-label={`Remover ${member.name} do time de suporte`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover {member.name} do time de suporte?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A conta continua existindo e mantém o acesso às empresas em que é membro — só
                                deixa de ver e responder os tickets de suporte.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => handleRemove(member)}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground text-xs">
                Administradores atendem todas as classificações e não saem do time por aqui. Para o time de
                suporte, clique nas classificações para ligar/desligar — salva na hora.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
