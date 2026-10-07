import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { Building2, CircleCheck, Clock, Inbox, MessageSquareReply, Search } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsSupportTeam } from "@/hooks/use-can";
import type { SupportDashboard } from "@/types/domain";
import { SEVERITY_INFO } from "./support-config";

const numberFormat = new Intl.NumberFormat("pt-BR");

/// Dashboard do time de suporte (/support/dashboard) — totais por status e
/// a mesma contagem por empresa. Quem tem a flag de suporte só enxerga as
/// classificações pelas quais responde (definidas na tela "Time de suporte");
/// Administrador vê tudo.
export function SupportDashboardPage() {
  const navigate = useNavigate();
  const isSupportTeam = useIsSupportTeam();
  const { data, error } = useSWR<SupportDashboard>(isSupportTeam ? "/api/support/dashboard" : null, {
    refreshInterval: 30000,
  });
  const [search, setSearch] = useState("");

  const organizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.organizations ?? []).filter((org) => !term || org.name.toLowerCase().includes(term));
  }, [data, search]);

  const totals = data?.totals;
  const percent = (part: number) => (totals && totals.total > 0 ? `${Math.round((part / totals.total) * 100)}% do total` : "—");

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Suporte técnico", to: "/support/dashboard" }, { label: "Dashboard" }]} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Dashboard de suporte</h1>
          <p className="text-muted-foreground mt-1 text-sm">Visão geral dos tickets abertos pelas empresas.</p>
        </div>
        {data && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Classificações que você atende:</span>
            {(data.severities ?? (["S1", "S2", "S3"] as const)).map((key) => (
              <Badge key={key} variant={SEVERITY_INFO[key].badge}>
                {SEVERITY_INFO[key].label} · {SEVERITY_INFO[key].name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {!isSupportTeam || error ? (
        <Card className="p-6 shadow-xl">
          <p className="text-muted-foreground text-sm">Dashboard exclusivo do time de suporte.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={Inbox}
              iconClassName="bg-primary/10 text-primary"
              label="Abertos"
              value={totals ? numberFormat.format(totals.OPEN) : "…"}
              sublabel={totals ? percent(totals.OPEN) : "Aguardando o apoio"}
            />
            <MetricCard
              icon={Clock}
              iconClassName="bg-warning/15 text-warning"
              label="Em atendimento"
              value={totals ? numberFormat.format(totals.IN_PROGRESS) : "…"}
              sublabel={totals ? percent(totals.IN_PROGRESS) : "Sendo tratados"}
            />
            <MetricCard
              icon={MessageSquareReply}
              iconClassName="bg-destructive/15 text-destructive"
              label="Aguardando empresa"
              value={totals ? numberFormat.format(totals.WAITING_CUSTOMER) : "…"}
              sublabel={totals ? percent(totals.WAITING_CUSTOMER) : "Esperando retorno"}
            />
            <MetricCard
              icon={CircleCheck}
              iconClassName="bg-success/15 text-success"
              label="Resolvidos"
              value={totals ? numberFormat.format(totals.RESOLVED) : "…"}
              sublabel={totals ? percent(totals.RESOLVED) : "Encerrados"}
            />
          </div>

          <Card className="flex flex-col gap-4 p-4 shadow-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="text-primary size-4" />
                <h2 className="text-base font-semibold">Tickets por organização</h2>
              </div>
              <div className="relative sm:w-72">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar organização"
                  className="h-9 pl-9"
                />
              </div>
            </div>

            {!data ? (
              <p className="text-muted-foreground py-10 text-center text-sm">Carregando…</p>
            ) : organizations.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">
                {data.organizations.length === 0
                  ? "Nenhuma organização abriu ticket nas suas classificações ainda."
                  : "Nenhuma organização com esse nome."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organização</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Abertos</TableHead>
                      <TableHead className="text-right">Em atendimento</TableHead>
                      <TableHead className="text-right">Aguardando empresa</TableHead>
                      <TableHead className="text-right">Resolvidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.organizationId}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell className="text-right font-semibold">{numberFormat.format(org.total)}</TableCell>
                        <TableCell className="text-right">{numberFormat.format(org.OPEN)}</TableCell>
                        <TableCell className="text-right">{numberFormat.format(org.IN_PROGRESS)}</TableCell>
                        <TableCell className="text-right">{numberFormat.format(org.WAITING_CUSTOMER)}</TableCell>
                        <TableCell className="text-right">{numberFormat.format(org.RESOLVED)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <button
              type="button"
              className="text-primary self-end text-xs font-medium hover:underline"
              onClick={() => navigate("/support")}
            >
              Ir para os tickets →
            </button>
          </Card>
        </>
      )}
    </div>
  );
}
