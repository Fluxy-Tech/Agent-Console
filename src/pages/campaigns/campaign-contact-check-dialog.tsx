import { Ban, Headset, Megaphone } from "lucide-react";
import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/// POST /api/campaigns/contact-check — telefones sempre como foram enviados.
export interface ContactCheckResult {
  /// Pediram pra não receber campanha nesta rede social — sempre saem do disparo.
  blockedPhones: string[];
  /// Com ticket aberto (em espera ou em atendimento) nesta rede social.
  inService: {
    phone: string;
    name: string | null;
    status: "WAITING" | "IN_PROGRESS";
    queueName: string;
    attendantName: string | null;
  }[];
  /// Em outra campanha desta rede social que ainda não terminou.
  inCampaign: { phone: string; campaigns: { id: string; name: string; paused: boolean }[] }[];
}

export function hasContactIssues(result: ContactCheckResult): boolean {
  return result.blockedPhones.length > 0 || result.inService.length > 0 || result.inCampaign.length > 0;
}

function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
      <ul className="bg-muted/40 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md p-2 text-xs">{children}</ul>
    </div>
  );
}

/// Alerta de segurança antes do disparo: mostra quem da lista está bloqueado,
/// em atendimento ou em outro disparo em andamento nesta rede social. Os
/// bloqueados nunca são enviados; os demais o usuário decide se remove ou se
/// dispara mesmo assim.
export function CampaignContactCheckDialog({
  result,
  totalContacts,
  onCancel,
  onRemoveFlagged,
  onSendAnyway,
}: {
  result: ContactCheckResult | null;
  totalContacts: number;
  onCancel: () => void;
  /// Tira da lista bloqueados + em atendimento + em disparo.
  onRemoveFlagged: () => void;
  /// Tira só os bloqueados.
  onSendAnyway: () => void;
}) {
  const blocked = result?.blockedPhones ?? [];
  const inService = result?.inService ?? [];
  const inCampaign = result?.inCampaign ?? [];
  const hasWarnings = inService.length > 0 || inCampaign.length > 0;

  const flagged = new Set([...blocked, ...inService.map((c) => c.phone), ...inCampaign.map((c) => c.phone)]);
  const remainingIfRemoved = totalContacts - flagged.size;
  const remainingIfAnyway = totalContacts - blocked.length;

  return (
    <AlertDialog open={result !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{hasWarnings ? "Atenção antes de disparar" : "Contatos bloqueados para campanha"}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasWarnings
              ? `${flagged.size} de ${totalContacts} contato(s) da lista precisam da sua atenção nesta rede social.`
              : `${blocked.length} contato(s) já pediram para não receber mais mensagens de campanha nesta rede social e não serão incluídos neste disparo.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4">
          {inService.length > 0 && (
            <Section
              icon={<Headset className="text-primary size-4" />}
              title={`Em atendimento (${inService.length})`}
              hint="Têm um ticket aberto agora, e o template chegaria no meio da conversa com o atendente."
            >
              {inService.map((c) => (
                <li key={c.phone}>
                  <span className="font-medium">{c.name ? `${c.name} · ${c.phone}` : c.phone}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {c.status === "WAITING" ? "aguardando na fila" : "em atendimento na fila"} {c.queueName}
                    {c.attendantName ? ` com ${c.attendantName}` : ""}
                  </span>
                </li>
              ))}
            </Section>
          )}

          {inCampaign.length > 0 && (
            <Section
              icon={<Megaphone className="text-primary size-4" />}
              title={`Em outro disparo em andamento (${inCampaign.length})`}
              hint="Já estão em uma campanha desta rede social que ainda não terminou e receberiam mais de um template."
            >
              {inCampaign.map((c) => (
                <li key={c.phone}>
                  <span className="font-medium">{c.phone}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {c.campaigns.map((camp) => `${camp.name}${camp.paused ? " (pausada)" : ""}`).join(", ")}
                  </span>
                </li>
              ))}
            </Section>
          )}

          {blocked.length > 0 && (
            <Section
              icon={<Ban className="text-destructive size-4" />}
              title={`Bloqueados (${blocked.length})`}
              hint="Pediram para não receber campanhas e ficam fora do disparo em qualquer opção."
            >
              {blocked.map((phone) => (
                <li key={phone} className="font-medium">
                  {phone}
                </li>
              ))}
            </Section>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {hasWarnings && (
            <Button variant="outline" disabled={remainingIfAnyway === 0} onClick={onSendAnyway}>
              Disparar mesmo assim
            </Button>
          )}
          <Button disabled={remainingIfRemoved === 0} onClick={onRemoveFlagged}>
            {hasWarnings ? `Remover e disparar (${remainingIfRemoved})` : "Continuar sem eles"}
          </Button>
        </AlertDialogFooter>
        {remainingIfRemoved === 0 && (
          <p className="text-muted-foreground text-right text-xs">
            Removendo esses contatos não sobra ninguém na lista para disparar.
          </p>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
