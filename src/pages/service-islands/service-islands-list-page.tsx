import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { Waypoints } from "lucide-react";
import { PageBreadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceIsland } from "@/types/domain";

export function ServiceIslandsListPage() {
  const navigate = useNavigate();
  const { data: islands } = useSWR<ServiceIsland[]>("/api/service-islands");

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Ilhas de Atendimento", to: "/service-island" }, { label: "Lista" }]} />

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Ilhas de Atendimento</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cada rede social tem uma ilha de atendimento, criada automaticamente.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {islands?.map((island) => (
          <Card
            key={island.id}
            className="hover:border-primary/50 shadow-xl cursor-pointer transition-colors"
            onClick={() => navigate(`/service-island/${island.id}`)}
          >
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                <Waypoints className="size-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{island.name}</CardTitle>
                <p className="text-muted-foreground truncate text-xs">
                  {island.queues?.length ?? 0} fila(s) · {island.whatsappChannel?.displayNumber}
                </p>
              </div>
            </CardHeader>
          </Card>
        ))}
        {islands && islands.length === 0 && (
          <p className="text-muted-foreground col-span-full text-sm">
            Nenhuma ilha de atendimento ainda. Crie uma rede social para gerar uma automaticamente.
          </p>
        )}
      </div>
    </div>
  );
}
