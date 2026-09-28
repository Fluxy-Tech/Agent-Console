import { Check, Eye, Minus, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PERMISSION_MATRIX,
  PermissionAction,
  ROLE_LABELS,
  SCREEN_PERMISSIONS,
  type MemberRole,
  type ScreenPermission,
} from "@/domain/permission-action";

const ROLES: MemberRole[] = ["GERENTE", "SUPERVISOR", "ATENDENTE"];

const ROLE_SUMMARIES: Record<MemberRole, string> = {
  GERENTE: "Acesso completo à empresa: configura agentes, canais e ilhas e gerencia os acessos da equipe.",
  SUPERVISOR: "Cuida da operação do dia a dia: contatos, campanhas, Kanban e métricas.",
  ATENDENTE: "Consulta os contatos da empresa, sem editar. O atendimento em si acontece no Desk.",
};

/// A tela de Acessos não é configurável por checkbox — entra aqui à parte.
const ACCESS_SCREEN: ScreenPermission = {
  label: "Acessos",
  view: [PermissionAction.ACCESS_VIEW],
  write: [PermissionAction.ACCESS_WRITE],
};

type Level = "edit" | "view" | "none";

/// Lido direto de PERMISSION_MATRIX, então a explicação nunca fica
/// desatualizada em relação ao que o papel realmente libera.
function levelFor(role: MemberRole, screen: ScreenPermission): Level {
  const actions = PERMISSION_MATRIX[role];
  const has = (list: PermissionAction[]) => list.length > 0 && list.every((a) => actions.includes(a));
  if (has(screen.write)) return "edit";
  if (has(screen.view)) return "view";
  return "none";
}

function LevelCell({ level }: { level: Level }) {
  if (level === "edit") {
    return (
      <span className="text-success inline-flex items-center gap-1 text-xs font-medium">
        <Check className="size-3.5" /> Acessa e edita
      </span>
    );
  }
  if (level === "view") {
    return (
      <span className="text-primary inline-flex items-center gap-1 text-xs font-medium">
        <Eye className="size-3.5" /> Só visualiza
      </span>
    );
  }
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <Minus className="size-3.5" /> Sem acesso
    </span>
  );
}

/// Explicação, na tela de Acessos, do que cada papel pode acessar e executar
/// por padrão (antes de qualquer personalização por checkbox).
export function RolePermissionsCard() {
  const screens = [...SCREEN_PERMISSIONS, ACCESS_SCREEN];

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <ShieldQuestion className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">O que cada papel pode fazer</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Este é o padrão de cada papel. Pelo botão de permissões na lista acima, dá para liberar ou restringir
              telas para um usuário específico — só a tela de Acessos continua exclusiva do Gerente.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((role) => (
            <div key={role} className="border-border flex flex-col gap-1.5 rounded-lg border p-3">
              <Badge variant="secondary" className="w-fit">
                {ROLE_LABELS[role]}
              </Badge>
              <p className="text-muted-foreground text-xs">{ROLE_SUMMARIES[role]}</p>
            </div>
          ))}
        </div>

        <div className="border-border overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Tela</TableHead>
                {ROLES.map((role) => (
                  <TableHead key={role}>{ROLE_LABELS[role]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {screens.map((screen) => (
                <TableRow key={screen.label}>
                  <TableCell className="text-left font-medium">{screen.label}</TableCell>
                  {ROLES.map((role) => (
                    <TableCell key={role}>
                      <LevelCell level={levelFor(role, screen)} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-muted-foreground text-xs">
          <strong className="text-foreground">Administrador</strong> é um acesso da plataforma Sturnus Flow: enxerga
          e edita tudo, em todas as empresas, e não depende do papel nem das permissões desta tela.
        </p>
      </CardContent>
    </Card>
  );
}
