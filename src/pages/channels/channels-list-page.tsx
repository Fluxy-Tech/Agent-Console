import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { MessageSquare, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCan } from "@/hooks/use-can";
import { PermissionAction } from "@/domain/permission-action";
import { api, ApiError } from "@/lib/api";
import type { Agent, Channel } from "@/types/domain";

interface WabaPhoneNumberResult {
  phoneNumberId: string;
  displayNumber: string;
  verifiedName: string;
  alreadyRegistered: boolean;
}

export function ChannelsListPage() {
  const navigate = useNavigate();
  const can = useCan();
  const canWrite = can(PermissionAction.WABAS_WRITE);
  const { data: channels, mutate } = useSWR<Channel[]>("/api/channels");
  const { data: agents } = useSWR<Agent[]>(canWrite ? "/api/agents" : null);

  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayNumber, setDisplayNumber] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupAgentId, setLookupAgentId] = useState("");
  const [lookupWabaId, setLookupWabaId] = useState("");
  const [lookupMetaAccessToken, setLookupMetaAccessToken] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<WabaPhoneNumberResult[] | null>(null);
  const [registering, setRegistering] = useState(false);

  function resetLookup() {
    setLookupAgentId("");
    setLookupWabaId("");
    setLookupMetaAccessToken("");
    setSearchError(null);
    setResults(null);
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setSearchError(null);
    setSearching(true);
    try {
      const found = await api.post<WabaPhoneNumberResult[]>("/api/channels/waba-lookup", {
        wabaId: lookupWabaId,
        metaAccessToken: lookupMetaAccessToken,
      });
      setResults(found);
      if (found.length === 0) setSearchError("Nenhum número encontrado para este WABA.");
    } catch (err) {
      setResults(null);
      setSearchError(err instanceof ApiError ? err.message : "Não foi possível buscar os números.");
    } finally {
      setSearching(false);
    }
  }

  function handleRemoveResult(phoneNumberId: string) {
    setResults((prev) => prev?.filter((r) => r.phoneNumberId !== phoneNumberId) ?? null);
  }

  async function handleRegisterAll() {
    const toRegister = results?.filter((r) => !r.alreadyRegistered) ?? [];
    if (toRegister.length === 0) return;

    setSearchError(null);
    setRegistering(true);
    try {
      const result = await api.post<{ created: unknown[]; skipped: unknown[] }>("/api/channels/bulk", {
        agentId: lookupAgentId || undefined,
        wabaId: lookupWabaId,
        metaAccessToken: lookupMetaAccessToken,
        phoneNumbers: toRegister.map((r) => ({ phoneNumberId: r.phoneNumberId, displayNumber: r.displayNumber })),
      });
      await mutate();
      toast.success(
        result.skipped.length > 0
          ? `${result.created.length} número(s) cadastrado(s), ${result.skipped.length} já existia(m).`
          : `${result.created.length} número(s) cadastrado(s).`,
      );
      setLookupOpen(false);
      resetLookup();
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : "Não foi possível cadastrar os números.");
    } finally {
      setRegistering(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Agente é opcional: sem seleção, o canal nasce só com atendimento
      // humano (openAgent=false, resolvido pelo Agent-Api).
      await api.post("/api/channels", { agentId: agentId || undefined, phoneNumberId, displayNumber, wabaId, metaAccessToken });
      await mutate();
      setOpen(false);
      setAgentId("");
      setPhoneNumberId("");
      setDisplayNumber("");
      setWabaId("");
      setMetaAccessToken("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o canal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageBreadcrumb items={[{ label: "Redes sociais", to: "/channels" }, { label: "Lista" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Redes sociais</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Canais do WhatsApp vinculados aos agentes desta empresa.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Dialog
              open={lookupOpen}
              onOpenChange={(v) => {
                setLookupOpen(v);
                if (!v) resetLookup();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Search className="size-4" /> Procurar números por WABA
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Procurar números por WABA</DialogTitle>
                  <DialogDescription>
                    Busca na Meta todos os números cadastrados no WhatsApp Business Account informado. Remova da
                    lista os que não quiser cadastrar antes de confirmar.
                  </DialogDescription>
                </DialogHeader>

                <form className="flex flex-col gap-4" onSubmit={handleSearch}>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lookup-agent">Agente (opcional)</Label>
                    <Select value={lookupAgentId} onValueChange={setLookupAgentId}>
                      <SelectTrigger id="lookup-agent" className="w-full">
                        <SelectValue placeholder="Nenhum (só atendimento humano)" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents?.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      Sem agente selecionado, os canais cadastrados nascem direcionando direto pro atendimento humano.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lookup-waba-id">WhatsApp Business Account ID</Label>
                    <Input
                      id="lookup-waba-id"
                      required
                      value={lookupWabaId}
                      onChange={(e) => setLookupWabaId(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lookup-meta-access-token">Token de acesso da Meta</Label>
                    <div className="flex gap-2">
                      <Input
                        id="lookup-meta-access-token"
                        type="password"
                        required
                        value={lookupMetaAccessToken}
                        onChange={(e) => setLookupMetaAccessToken(e.target.value)}
                      />
                      <Button type="submit" disabled={searching}>
                        {searching ? "Buscando…" : "Procurar"}
                      </Button>
                    </div>
                  </div>
                </form>

                {searchError && <p className="text-destructive text-sm">{searchError}</p>}

                {results && results.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                      {results.map((r) => (
                        <div
                          key={r.phoneNumberId}
                          className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{r.displayNumber}</p>
                            <p className="text-muted-foreground truncate text-xs">{r.verifiedName}</p>
                          </div>
                          {r.alreadyRegistered ? (
                            <Badge variant="outline">Já cadastrado</Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveResult(r.phoneNumberId)}
                              className="text-muted-foreground hover:text-destructive shrink-0"
                              aria-label={`Remover ${r.displayNumber}`}
                            >
                              <X className="size-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={handleRegisterAll}
                      disabled={registering || results.every((r) => r.alreadyRegistered)}
                    >
                      {registering ? "Cadastrando…" : "Cadastrar"}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Novo canal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova rede social</DialogTitle>
                  <DialogDescription>
                    Uma ilha de atendimento é criada automaticamente para este canal.
                  </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4" onSubmit={handleCreate}>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wc-agent">Agente (opcional)</Label>
                    <Select value={agentId} onValueChange={setAgentId}>
                      <SelectTrigger id="wc-agent" className="w-full">
                        <SelectValue placeholder="Nenhum (só atendimento humano)" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents?.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      Sem agente selecionado, o canal nasce direcionando direto pro atendimento humano.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wc-phone-number-id">Phone Number ID</Label>
                    <Input
                      id="wc-phone-number-id"
                      required
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wc-display-number">Número de exibição</Label>
                    <Input
                      id="wc-display-number"
                      required
                      value={displayNumber}
                      onChange={(e) => setDisplayNumber(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wc-waba-id">WhatsApp Business Account ID</Label>
                    <Input id="wc-waba-id" required value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wc-meta-access-token">Token de acesso da Meta</Label>
                    <Input
                      id="wc-meta-access-token"
                      type="password"
                      required
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button type="submit" disabled={saving}>
                    {saving ? "Criando…" : "Criar canal"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {channels?.map((channel) => (
          <Card
            key={channel.id}
            className="hover:border-primary/50 shadow-xl cursor-pointer transition-colors"
            onClick={() => navigate(`/channels/${channel.id}`)}
          >
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                <MessageSquare className="size-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{channel.displayNumber}</CardTitle>
                <p className="text-muted-foreground truncate text-xs">{channel.serviceIsland?.name}</p>
              </div>
            </CardHeader>
          </Card>
        ))}
        {channels && channels.length === 0 && (
          <p className="text-muted-foreground col-span-full text-sm">Nenhuma rede social cadastrada ainda.</p>
        )}
      </div>
    </div>
  );
}
