import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CONFIGURABLE_PERMISSIONS,
  ROLE_LABELS,
  SCREEN_PERMISSIONS,
  resolvePermissions,
  type PermissionAction,
} from "@/domain/permission-action";
import { api, ApiError } from "@/lib/api";
import type { Member } from "@/types/domain";

interface MemberPermissionsDialogProps {
  companyId: string;
  member: Member | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/// Checkboxes de telas por usuário (tela de Acessos). "Acessar" libera ver a
/// tela (e o item no menu); "Editar" libera criar/alterar nela e já marca
/// "Acessar" junto. Acessos e gestão de empresas seguem presos ao papel.
export function MemberPermissionsDialog({ companyId, member, onOpenChange, onSaved }: MemberPermissionsDialogProps) {
  const [selected, setSelected] = useState<Set<PermissionAction>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member) return;
    const effective = resolvePermissions(member.role, member.permissions);
    setSelected(new Set(effective.filter((action) => CONFIGURABLE_PERMISSIONS.includes(action))));
  }, [member]);

  const hasAll = (actions: PermissionAction[]) => actions.length > 0 && actions.every((a) => selected.has(a));

  function toggle(actions: PermissionAction[], checked: boolean, alsoRemove: PermissionAction[] = []) {
    setSelected((current) => {
      const next = new Set(current);
      for (const action of actions) {
        if (checked) next.add(action);
        else next.delete(action);
      }
      if (!checked) for (const action of alsoRemove) next.delete(action);
      return next;
    });
  }

  async function save(permissions: PermissionAction[] | null) {
    if (!member) return;
    setSaving(true);
    try {
      await api.put(`/api/companies/${companyId}/members/${member.id}/permissions`, { permissions });
      toast.success(permissions ? "Permissões atualizadas." : "Permissões voltaram ao padrão do papel.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar as permissões.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Permissões de {member?.user.name}</DialogTitle>
          <DialogDescription>
            Marque as telas que este usuário pode acessar e editar nesta empresa. A tela de Acessos continua
            liberada só para o papel {ROLE_LABELS.GERENTE}.
          </DialogDescription>
        </DialogHeader>

        <div className="border-border overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Tela</TableHead>
                <TableHead className="w-24">Acessar</TableHead>
                <TableHead className="w-24">Editar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SCREEN_PERMISSIONS.map((screen) => (
                <TableRow key={screen.label}>
                  <TableCell className="text-left font-medium">{screen.label}</TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={hasAll(screen.view)}
                        aria-label={`Acessar ${screen.label}`}
                        // Sem acesso não dá pra editar: desmarcar Acessar tira o Editar junto.
                        onCheckedChange={(checked) => toggle(screen.view, checked === true, screen.write)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      {screen.write.length > 0 ? (
                        <Checkbox
                          checked={hasAll(screen.write)}
                          aria-label={`Editar ${screen.label}`}
                          // Editar implica Acessar.
                          onCheckedChange={(checked) =>
                            checked === true
                              ? toggle([...screen.view, ...screen.write], true)
                              : toggle(screen.write, false)
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={saving || member?.permissions === null}
            onClick={() => save(null)}
            title="Descarta as marcações e volta a seguir o papel do usuário"
          >
            Usar padrão do papel
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => save([...selected])}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
