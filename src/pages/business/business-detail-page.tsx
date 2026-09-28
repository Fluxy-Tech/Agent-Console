import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import useSWR from "swr";
import { Check, Copy, Eye, EyeOff, KeyRound, ListChecks, Lock, Ticket, Trash2, Unlock, UserX, Users } from "lucide-react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls } from "@/components/pagination-controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { useCan } from "@/hooks/use-can";
import { PermissionAction, ROLE_LABELS, type MemberRole } from "@/domain/permission-action";
import { useAppSelector } from "@/store/hooks";
import type { Company, InvitationMember, Member } from "@/types/domain";
import { MemberPermissionsDialog } from "./member-permissions-dialog";
import { RolePermissionsCard } from "./role-permissions-card";

const ROLE_OPTIONS: MemberRole[] = ["GERENTE", "SUPERVISOR", "ATENDENTE"];

export function BusinessDetailPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const can = useCan();
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  // Sem :id na rota (tela "Acessos" do menu lateral, /access) = gerencia a
  // empresa ativa. Com :id (vindo da lista de empresas) = gerencia a empresa
  // informada, mesmo que não seja a ativa (ex: administrador navegando).
  const activeCompanyId = useAppSelector((s) => s.activeCompany?.id);
  const id = paramId ?? activeCompanyId;
  const { data: company, mutate: mutateCompany } = useSWR<Company>(id ? `/api/companies/${id}` : null);
  const { data: members, mutate } = useSWR<Member[]>(id ? `/api/companies/${id}/members` : null);
  const { data: inviteCodes, mutate: mutateInviteCodes } = useSWR<InvitationMember[]>(
    id ? `/api/companies/${id}/invite-codes` : null,
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [permissionsMember, setPermissionsMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pagedMembers = (members ?? []).slice((page - 1) * pageSize, page * pageSize);

  const [generatingToken, setGeneratingToken] = useState(false);
  const [viewingToken, setViewingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenDialogMode, setTokenDialogMode] = useState<"generated" | "viewed" | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);

  const [inviteRole, setInviteRole] = useState<MemberRole>("ATENDENTE");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<InvitationMember | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const canWrite = can(PermissionAction.ACCESS_WRITE);

  async function handleRoleChange(memberId: string, role: MemberRole) {
    setError(null);
    setSavingId(memberId);
    try {
      await api.put(`/api/companies/${id}/members/${memberId}`, { role });
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar o tipo de acesso.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleBlocked(member: Member) {
    setError(null);
    setBlockingId(member.id);
    try {
      await api.patch(`/api/companies/${id}/members/${member.id}/blocked`, { blocked: !member.blocked });
      await mutate();
      toast.success(member.blocked ? "Acesso desbloqueado." : "Acesso bloqueado.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível alterar o bloqueio.");
    } finally {
      setBlockingId(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    setError(null);
    setRemovingId(memberId);
    try {
      await api.delete(`/api/companies/${id}/members/${memberId}`);
      await mutate();
      toast.success("Acesso removido.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível remover o acesso.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleGenerateToken() {
    setTokenError(null);
    setGeneratingToken(true);
    try {
      const { token } = await api.post<{ token: string }>(`/api/companies/${id}/api-token`, {});
      setGeneratedToken(token);
      setTokenDialogMode("generated");
      setCopied(false);
      setTokenVisible(false);
      await mutateCompany();
    } catch (err) {
      setTokenError(err instanceof ApiError ? err.message : "Não foi possível gerar o token.");
    } finally {
      setGeneratingToken(false);
    }
  }

  async function handleViewToken() {
    setTokenError(null);
    setViewingToken(true);
    try {
      const { token } = await api.get<{ token: string | null }>(`/api/companies/${id}/api-token`);
      if (!token) {
        setTokenError("Nenhum token configurado.");
        return;
      }
      setGeneratedToken(token);
      setTokenDialogMode("viewed");
      setCopied(false);
      setTokenVisible(false);
    } catch (err) {
      setTokenError(err instanceof ApiError ? err.message : "Não foi possível carregar o token.");
    } finally {
      setViewingToken(false);
    }
  }

  function closeTokenDialog() {
    setGeneratedToken(null);
    setTokenDialogMode(null);
  }

  async function handleCopyToken() {
    if (!generatedToken) return;
    await navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    toast.success("Token copiado.");
  }

  async function handleGenerateCode(event: FormEvent) {
    event.preventDefault();
    setCodeError(null);
    setGeneratingCode(true);
    try {
      const invitation = await api.post<InvitationMember>(`/api/companies/${id}/invite-codes`, {
        role: inviteRole,
        email: inviteEmail,
      });
      setGeneratedCode(invitation);
      setCodeCopied(false);
      setInviteEmail("");
      await mutateInviteCodes();
    } catch (err) {
      setCodeError(err instanceof ApiError ? err.message : "Não foi possível gerar o código.");
    } finally {
      setGeneratingCode(false);
    }
  }

  async function handleDeleteInvite(invitation: InvitationMember) {
    setDeletingInviteId(invitation.id);
    try {
      await api.delete(`/api/companies/${id}/invite-codes/${invitation.id}`);
      toast.success("Convite excluído.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o convite.");
    } finally {
      setDeletingInviteId(null);
      await mutateInviteCodes();
    }
  }

  async function handleCopyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCodeCopied(true);
    toast.success("Código copiado.");
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        {/* Sem :id (rota /access, vinda do menu lateral) = trilha fixa "Acessos".
            Com :id (vindo da lista de empresas em /business) essa página não
            faz parte do fluxo com sidebar, então não mostramos breadcrumb. */}
        {!paramId && <PageBreadcrumb items={[{ label: "Acessos" }]} />}

        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {company?.name ?? "Empresa"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">CNPJ {company?.cnpj}</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Users className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Acessos</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  Gerencie quem tem acesso a esta empresa, o papel e as telas liberadas de cada pessoa, e bloqueie
                  ou remova acessos quando necessário.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && <p className="text-destructive mb-3 text-sm">{error}</p>}
            <div className="border-border overflow-hidden rounded-lg border">
              {!members || members.length === 0 ? (
                <div className="text-muted-foreground p-6 text-sm">
                  {!members ? "Carregando…" : "Nenhum acesso encontrado."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Usuário</TableHead>
                      <TableHead className="text-center">Papel</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedMembers.map((member) => {
                      const isSelf = member.userId === currentUserId;
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="text-left">
                            <div className="flex items-center justify-start gap-2">
                              <div className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                                {member.user.name.trim().charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 truncate font-medium">
                                  {member.user.name}
                                  {isSelf && <Badge variant="secondary">Você</Badge>}
                                  {member.blocked && <Badge variant="destructive">Bloqueado</Badge>}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">{member.user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              {canWrite ? (
                                <Select
                                  value={member.role}
                                  disabled={savingId === member.id}
                                  onValueChange={(value) => handleRoleChange(member.id, value as MemberRole)}
                                >
                                  <SelectTrigger size="sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ROLE_OPTIONS.map((role) => (
                                      <SelectItem key={role} value={role}>
                                        {ROLE_LABELS[role]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              {canWrite && !isSelf ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setPermissionsMember(member)}
                                    title={
                                      member.permissions
                                        ? "Permissões de telas (personalizadas)"
                                        : "Permissões de telas (padrão do papel)"
                                    }
                                    className={member.permissions ? "border-primary text-primary" : undefined}
                                  >
                                    <ListChecks className="size-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    disabled={blockingId === member.id}
                                    onClick={() => handleToggleBlocked(member)}
                                    title={member.blocked ? "Desbloquear acesso" : "Bloquear acesso temporariamente"}
                                  >
                                    {member.blocked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
                                  </Button>

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        disabled={removingId === member.id}
                                        className="text-destructive hover:text-destructive"
                                        title="Remover acesso"
                                      >
                                        <UserX className="size-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remover acesso de {member.user.name}?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {member.user.name} perde o acesso a esta empresa imediatamente. Pra voltar,
                                          alguém precisa gerar um novo convite ou código. Esta ação não pode ser
                                          desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          variant="destructive"
                                          onClick={() => handleRemoveMember(member.id)}
                                        >
                                          Remover
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
          {members && members.length > 0 && (
            <PaginationControls
              page={page}
              pageSize={pageSize}
              total={members.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </Card>

        <RolePermissionsCard />

        {canWrite && (
          <Card className="shadow-xl">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Ticket className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Código de convite</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Gere um código pro e-mail da pessoa que você quer convidar. Na tela de cadastro, o resgate só é
                    aceito se ela se cadastrar com esse mesmo e-mail — já entra direto nesta empresa, com o papel
                    escolhido abaixo.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={handleGenerateCode} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="invite-email">E-mail convidado</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    placeholder="pessoa@empresa.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" variant="outline" disabled={generatingCode}>
                  <Ticket className="size-4" />
                  {generatingCode ? "Gerando…" : "Gerar código"}
                </Button>
              </form>
              {codeError && <p className="text-destructive text-sm">{codeError}</p>}

              {inviteCodes && inviteCodes.length > 0 && (
                <div className="flex flex-col gap-2">
                  {inviteCodes.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <code className="bg-muted rounded-md px-2 py-1 text-sm font-medium tracking-wider">
                          {invitation.code}
                        </code>
                        <div className="min-w-0">
                          <p className="text-xs font-medium">
                            {ROLE_LABELS[invitation.role]} · <span className="font-normal">{invitation.email}</span>
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {invitation.finish ? "Ainda não utilizado" : `Usado por ${invitation.user?.name ?? "—"}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={invitation.finish ? "default" : "outline"}>
                          {invitation.finish ? "Ativo" : "Usado"}
                        </Badge>
                        {invitation.finish && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Copiar código"
                              onClick={() => handleCopyCode(invitation.code)}
                            >
                              <Copy className="size-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={deletingInviteId === invitation.id}
                                  className="text-destructive hover:text-destructive"
                                  title="Excluir convite"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir o convite {invitation.code}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O código enviado para {invitation.email} deixa de funcionar imediatamente. Se
                                    precisar, gere um novo convite depois. Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    variant="destructive"
                                    onClick={() => handleDeleteInvite(invitation)}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {canWrite && (
          <Card className="shadow-xl">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <KeyRound className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Acesso à API externa</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Token usado por sistemas de terceiros para consultar canais/templates e disparar campanhas desta
                    empresa via API (Fluxy Agents).
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant={company?.hasApiAccessToken ? "default" : "outline"}
                  disabled={!company?.hasApiAccessToken || viewingToken}
                  onClick={handleViewToken}
                >
                  <Eye className="size-4" />
                  {viewingToken ? "Carregando…" : company?.hasApiAccessToken ? "Token configurado" : "Nenhum token gerado"}
                </Button>
                <Button variant="outline" disabled={generatingToken} onClick={handleGenerateToken}>
                  <KeyRound className="size-4" />
                  {generatingToken ? "Gerando…" : "Gerar novo token"}
                </Button>
              </div>
              {tokenError && <p className="text-destructive text-sm">{tokenError}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={tokenDialogMode !== null} onOpenChange={(open) => !open && closeTokenDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tokenDialogMode === "generated" ? "Token gerado" : "Token de acesso"}</DialogTitle>
            <DialogDescription>
              {tokenDialogMode === "generated"
                ? "Copie e guarde este token agora. Qualquer token anterior desta empresa deixou de funcionar."
                : "Este é o token de acesso à API externa configurado atualmente para esta empresa."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 overflow-x-auto rounded-md px-3 py-2 text-xs break-all">
              {tokenVisible ? generatedToken : "•".repeat(generatedToken?.length ?? 0)}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setTokenVisible((v) => !v)}
              aria-label={tokenVisible ? "Ocultar token" : "Mostrar token"}
            >
              {tokenVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={handleCopyToken}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(generatedCode)} onOpenChange={(open) => !open && setGeneratedCode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Código gerado</DialogTitle>
            <DialogDescription>
              Envie este código para <strong>{generatedCode?.email}</strong> digitar na tela de cadastro — só é
              aceito se ela se cadastrar com esse e-mail. Papel: {generatedCode && ROLE_LABELS[generatedCode.role]}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 rounded-md px-3 py-2 text-center text-lg font-semibold tracking-[0.3em]">
              {generatedCode?.code}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => generatedCode && handleCopyCode(generatedCode.code)}
            >
              {codeCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {id && (
        <MemberPermissionsDialog
          companyId={id}
          member={permissionsMember}
          onOpenChange={(open) => !open && setPermissionsMember(null)}
          onSaved={() => void mutate()}
        />
      )}
    </div>
  );
}
