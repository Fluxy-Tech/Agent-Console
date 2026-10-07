import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import Papa from "papaparse";
import { toast } from "sonner";
import { CheckCircle2, Download, Eye, FileSpreadsheet, FileText, Headset, Radio, Reply, Send, Upload, Users, XCircle } from "lucide-react";
import fundoWhatsApp from "@/assets/FundoWhatsApp.jpg";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import type { Channel, ServiceIsland, Template } from "@/types/domain";

interface ParsedRow {
  index: number;
  phone: string;
  name: string;
  email: string;
  variables: string[];
  errors: string[];
}

interface ContactPayload {
  phone: string;
  name?: string;
  email?: string;
  parametersHeader?: { type: string; text: string }[];
  parametersBody?: { type: string; text: string }[];
}

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/// Sem `values`: mostra o placeholder "[Variável N]" (modo CSV, onde cada
/// contato tem seu próprio valor — não há um único valor pra pré-visualizar).
/// Com `values`: substitui pelo valor já digitado no disparo manual, pra dar
/// pra ver como a mensagem fica de verdade.
function highlightVariables(text: string | undefined, values?: string[]): string {
  if (!text) return "";
  return text.replace(/\{\{(\d+)\}\}/g, (match, n: string) => {
    const value = values?.[Number(n) - 1];
    return value ? value : `[Variável ${n}]`;
  });
}

/// Trecho entre *asteriscos simples* (formatação de negrito do WhatsApp) vira
/// <strong> de verdade na pré-visualização, em vez de mostrar os asteriscos.
function renderBold(text: string): ReactNode {
  return text.split(/\*(.+?)\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

export function CampaignNewTab() {
  const navigate = useNavigate();

  const { data: channels } = useSWR<Channel[]>("/api/channels");
  const { data: islands } = useSWR<ServiceIsland[]>("/api/service-islands");

  const [whatsappChannelId, setWhatsappChannelId] = useState("");
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingBlocked, setCheckingBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preenchidos quando /api/campaigns/blocked-contacts encontra contatos
  // bloqueados — abre o alerta de confirmação em vez de disparar direto.
  const [blockedPhones, setBlockedPhones] = useState<string[] | null>(null);
  const [pendingContacts, setPendingContacts] = useState<ContactPayload[] | null>(null);

  const [routeToHuman, setRouteToHuman] = useState(false);
  const [routeToQueueId, setRouteToQueueId] = useState("");
  const [assignSpecificAttendant, setAssignSpecificAttendant] = useState(false);
  const [routeToUserId, setRouteToUserId] = useState("");

  const [mode, setMode] = useState<"CSV" | "MANUAL">("CSV");

  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualVariables, setManualVariables] = useState<string[]>([]);

  // Disparo em massa (CSV) é escalonado: batchSize contatos a cada
  // batchIntervalMinutes, enviados pelo scheduler do Campaign-Worker.
  const [batchSize, setBatchSize] = useState("");
  const [batchIntervalMinutes, setBatchIntervalMinutes] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  // Valor cru do <input type="datetime-local"> (horário local, sem fuso).
  const [scheduledAt, setScheduledAt] = useState("");

  const currentIsland = islands?.find((i) => i.whatsappChannelId === whatsappChannelId);
  const queuesForIsland = currentIsland?.queues ?? [];
  const selectedQueue = queuesForIsland.find((q) => q.id === routeToQueueId);
  const selectedTemplate = templates?.find((t) => t.name === templateName) ?? null;
  const headerCount = selectedTemplate?.variableCount.header ?? 0;
  const bodyCount = selectedTemplate?.variableCount.body ?? 0;
  const totalVars = headerCount + bodyCount;

  const headerComponent = selectedTemplate?.components.find((c) => c.type === "HEADER");
  const bodyComponent = selectedTemplate?.components.find((c) => c.type === "BODY");
  const footerComponent = selectedTemplate?.components.find((c) => c.type === "FOOTER");
  const buttonsComponent = selectedTemplate?.components.find((c) => c.type === "BUTTONS");

  useEffect(() => {
    setRouteToQueueId("");
  }, [whatsappChannelId]);

  // Fila muda -> o atendente selecionado pode não pertencer mais a ela.
  useEffect(() => {
    setRouteToUserId("");
  }, [routeToQueueId]);

  useEffect(() => {
    setTemplateName("");
    setTemplates(null);
    setTemplatesError(null);
    if (!whatsappChannelId) return;

    api
      .get<Template[]>(`/api/channels/${whatsappChannelId}/templates`)
      .then((result) => setTemplates(result))
      .catch((err) => {
        setTemplatesError(err instanceof ApiError ? err.message : "Não foi possível listar os templates deste canal.");
        setTemplates([]);
      });
  }, [whatsappChannelId]);

  // Trocar de template muda a quantidade de variáveis esperadas — invalida o
  // que já tinha sido preenchido pra evitar submeter contatos validados contra
  // um template diferente.
  useEffect(() => {
    setRows(null);
    setFileName(null);
    setManualVariables(Array.from({ length: totalVars }, () => ""));
  }, [templateName, totalVars]);

  function parseRows(raw: Record<string, string>[]): ParsedRow[] {
    return raw.map((rawRow, i) => {
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawRow)) {
        normalized[normalizeKey(k)] = (v ?? "").toString().trim();
      }

      const phone = (normalized["telefone"] ?? normalized["phone"] ?? "").replace(/\D/g, "");
      const name = normalized["nome"] ?? normalized["name"] ?? "";
      const email = normalized["email"] ?? "";

      const variables: string[] = [];
      const errors: string[] = [];

      if (!phone || phone.length < 8) errors.push("Telefone ausente ou inválido");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email inválido");

      for (let v = 1; v <= totalVars; v++) {
        const value = normalized[`variavel${v}`] ?? normalized[`var${v}`] ?? "";
        variables.push(value);
        if (!value) errors.push(`Variável ${v} ausente`);
      }

      return { index: i + 1, phone, name, email, variables, errors };
    });
  }

  function handleFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setRows(parseRows(results.data)),
      error: () => {
        toast.error("Não foi possível ler o arquivo CSV.");
        setRows(null);
      },
    });
  }

  function downloadTemplate() {
    const headerCols = ["telefone", "nome", "email"];
    for (let v = 1; v <= totalVars; v++) headerCols.push(`variavel${v}`);

    const exampleRow = ["5511999999999", "Maria Silva", "maria@email.com"];
    for (let v = 1; v <= totalVars; v++) exampleRow.push(`valor da variável ${v}`);

    const csv = [headerCols.join(","), exampleRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo-${templateName || "campanha"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const validRows = useMemo(() => rows?.filter((r) => r.errors.length === 0) ?? [], [rows]);
  const invalidRows = useMemo(() => rows?.filter((r) => r.errors.length > 0) ?? [], [rows]);

  const manualPhoneDigits = manualPhone.replace(/\D/g, "");
  const manualErrors: string[] = [];
  if (manualPhone && manualPhoneDigits.length < 8) manualErrors.push("Telefone inválido");
  if (manualEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualEmail)) manualErrors.push("Email inválido");
  const manualMissingVariable = manualVariables.slice(0, totalVars).some((v) => !v);

  const batchSizeNumber = Number(batchSize);
  const batchIntervalNumber = Number(batchIntervalMinutes);
  const pacingValid =
    mode !== "CSV" ||
    (Number.isInteger(batchSizeNumber) && batchSizeNumber >= 1 && Number.isInteger(batchIntervalNumber) && batchIntervalNumber >= 1);
  const totalBatches = pacingValid && batchSizeNumber > 0 ? Math.ceil(validRows.length / batchSizeNumber) : 0;
  const totalDurationMinutes = Math.max(totalBatches - 1, 0) * batchIntervalNumber;

  const scheduledDate = scheduleEnabled && scheduledAt ? new Date(scheduledAt) : null;
  const scheduleValid = !scheduleEnabled || (scheduledDate !== null && scheduledDate.getTime() > Date.now());

  const canSubmit = Boolean(
    whatsappChannelId &&
      selectedTemplate &&
      campaignName.trim() &&
      !submitting &&
      !checkingBlocked &&
      (mode === "CSV"
        ? rows && rows.length > 0 && invalidRows.length === 0
        : manualPhoneDigits.length >= 8 && manualErrors.length === 0 && !manualMissingVariable) &&
      (!routeToHuman || routeToQueueId) &&
      (!routeToHuman || !assignSpecificAttendant || routeToUserId) &&
      pacingValid &&
      scheduleValid,
  );

  function buildContacts(): ContactPayload[] {
    return mode === "CSV"
      ? validRows.map((r) => ({
          phone: r.phone,
          name: r.name || undefined,
          email: r.email || undefined,
          parametersHeader:
            headerCount > 0 ? r.variables.slice(0, headerCount).map((v) => ({ type: "text", text: v })) : undefined,
          parametersBody:
            bodyCount > 0
              ? r.variables.slice(headerCount, headerCount + bodyCount).map((v) => ({ type: "text", text: v }))
              : undefined,
        }))
      : [
          {
            phone: manualPhoneDigits,
            name: manualName || undefined,
            email: manualEmail || undefined,
            parametersHeader:
              headerCount > 0
                ? manualVariables.slice(0, headerCount).map((v) => ({ type: "text", text: v }))
                : undefined,
            parametersBody:
              bodyCount > 0
                ? manualVariables.slice(headerCount, headerCount + bodyCount).map((v) => ({ type: "text", text: v }))
                : undefined,
          },
        ];
  }

  async function dispatchCampaign(contacts: ContactPayload[]) {
    if (!selectedTemplate) return;
    setSubmitting(true);
    try {
      const result = await api.post<{ id: string }>("/api/campaigns", {
        whatsappChannelId,
        name: campaignName.trim(),
        templateName: selectedTemplate.name,
        category: selectedTemplate.category,
        language: selectedTemplate.language,
        dispatchType: mode,
        templateHeaderText: headerComponent?.text,
        templateBodyText: bodyComponent?.text,
        contacts,
        routeToQueueId: routeToHuman ? routeToQueueId : undefined,
        routeToUserId: routeToHuman && assignSpecificAttendant ? routeToUserId : undefined,
        batchSize: mode === "CSV" ? batchSizeNumber : undefined,
        batchIntervalMinutes: mode === "CSV" ? batchIntervalNumber : undefined,
        scheduledAt: scheduledDate ? scheduledDate.toISOString() : undefined,
      });
      toast.success(
        scheduledDate
          ? `Campanha agendada para ${scheduledDate.toLocaleString("pt-BR")}.`
          : mode === "CSV"
            ? "Campanha criada — o disparo em lotes já começou."
            : "Campanha adicionada à fila de disparo.",
      );
      navigate(`/campaigns/${result.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar a campanha.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!selectedTemplate) return;
    setError(null);

    const contacts = buildContacts();

    setCheckingBlocked(true);
    try {
      const { blockedPhones: blocked } = await api.post<{ blockedPhones: string[] }>("/api/campaigns/blocked-contacts", {
        whatsappChannelId,
        phones: contacts.map((c) => c.phone),
      });

      if (blocked.length > 0) {
        setBlockedPhones(blocked);
        setPendingContacts(contacts);
        return;
      }

      await dispatchCampaign(contacts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível verificar contatos bloqueados.");
    } finally {
      setCheckingBlocked(false);
    }
  }

  function handleCancelBlocked() {
    setBlockedPhones(null);
    setPendingContacts(null);
  }

  async function handleContinueWithoutBlocked() {
    if (!pendingContacts || !blockedPhones) return;
    const blockedSet = new Set(blockedPhones);
    const filtered = pendingContacts.filter((c) => !blockedSet.has(c.phone));
    setBlockedPhones(null);
    setPendingContacts(null);
    await dispatchCampaign(filtered);
  }

  return (
    <div className="flex flex-col gap-4">
      <AlertDialog
        open={blockedPhones !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelBlocked();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Contatos bloqueados para campanha</AlertDialogTitle>
            <AlertDialogDescription>
              {blockedPhones?.length} contato(s) já pediram para não receber mais mensagens de campanha nesta rede
              social e não serão incluídos neste disparo: {blockedPhones?.join(", ")}. Deseja continuar o disparo sem
              eles?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleContinueWithoutBlocked}>Continuar sem eles</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Radio className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">Rede social</CardTitle>
              <CardDescription>Escolha a rede social pela qual esta campanha será disparada.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            {!channels ? (
              <p className="text-muted-foreground text-xs">Carregando redes sociais...</p>
            ) : channels.length === 0 ? (
              <p className="text-muted-foreground text-xs">Nenhuma rede social cadastrada.</p>
            ) : (
              <Select value={whatsappChannelId} onValueChange={setWhatsappChannelId}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Selecione a rede social" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {whatsappChannelId && (
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Headset className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Atendimento humano</CardTitle>
                <CardDescription>
                  Opcionalmente, encaminhe os contatos atingidos direto para uma fila de atendimento humano.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Switch checked={routeToHuman} onCheckedChange={setRouteToHuman} className="data-[state=checked]:bg-success" />
              <div>
                <Label>Direcionar para atendimento humano</Label>
                <p className="text-muted-foreground text-xs">
                  Em vez de continuar com a IA, os contatos atingidos já entram numa fila de atendimento humano.
                </p>
              </div>
            </div>

            {routeToHuman && (
              <>
                <div className="flex flex-col gap-1.5">
                  <div>
                    <Label>Fila de atendimento</Label>
                    <p className="text-muted-foreground mt-1 text-xs">Clique para escolher a fila.</p>
                  </div>
                  {queuesForIsland.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Nenhuma fila cadastrada na ilha de atendimento deste canal ainda.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {queuesForIsland.map((q) => (
                        <button
                          type="button"
                          key={q.id}
                          onClick={() => setRouteToQueueId(q.id)}
                          className={cn(
                            "cursor-pointer rounded-lg border px-4 py-2 text-left font-medium transition-colors",
                            routeToQueueId === q.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50",
                          )}
                        >
                          {q.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={assignSpecificAttendant}
                    onCheckedChange={setAssignSpecificAttendant}
                    className="data-[state=checked]:bg-success"
                  />
                  <Label>Atribuir a um atendente específico</Label>
                </div>

                {assignSpecificAttendant && (
                  <div className="flex flex-col gap-1.5">
                    <div>
                      <Label>Atendente</Label>
                      <p className="text-muted-foreground mt-1 text-xs">Clique para escolher o atendente.</p>
                    </div>
                    {!selectedQueue || (selectedQueue.members?.length ?? 0) === 0 ? (
                      <p className="text-muted-foreground text-xs">
                        {selectedQueue ? "Nenhum atendente cadastrado nessa fila ainda." : "Selecione uma fila primeiro."}
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(selectedQueue.members ?? []).map((m) => (
                          <button
                            type="button"
                            key={m.userId}
                            onClick={() => setRouteToUserId(m.userId)}
                            className={cn(
                              "cursor-pointer rounded-lg border px-4 py-2 text-left font-medium transition-colors",
                              routeToUserId === m.userId ? "border-primary bg-accent" : "border-border hover:bg-accent/50",
                            )}
                          >
                            {m.user.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {whatsappChannelId && (
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <FileText className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Template</CardTitle>
                <CardDescription>Escolha o template aprovado pela Meta que será enviado nesta campanha.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {templatesError ? (
              <p className="text-destructive text-sm">{templatesError}</p>
            ) : templates === null ? (
              <p className="text-muted-foreground text-sm">Carregando templates...</p>
            ) : templates.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum template encontrado para este canal.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTemplateName(t.name)}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                      templateName === t.name ? "border-primary bg-accent" : "border-border hover:bg-accent/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant="outline">{CATEGORY_LABEL[t.category] ?? t.category}</Badge>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {t.language} · {t.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedTemplate && (
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Eye className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Pré-visualização</CardTitle>
                <CardDescription>
                  Confira como a mensagem vai chegar pro cliente e preencha as variáveis do template.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div
                className="flex flex-1 items-start justify-center rounded-lg bg-[#e5ddd5] bg-repeat bg-[length:320px] p-6 [background-image:var(--wa-bg)]"
                style={{ "--wa-bg": `url(${fundoWhatsApp})` } as React.CSSProperties}
              >
                <div className="flex max-w-sm flex-col gap-[3px]">
                  <div className="relative flex flex-col gap-1 rounded-lg rounded-tr-none bg-white p-3 text-sm text-black shadow-md">
                    <div className="absolute top-0 right-0 size-0 translate-x-full border-t-8 border-r-8 border-t-white border-r-transparent" />
                    {headerComponent?.text && (
                      <p className="font-semibold">
                        {renderBold(
                          highlightVariables(headerComponent.text, mode === "MANUAL" ? manualVariables.slice(0, headerCount) : undefined),
                        )}
                      </p>
                    )}
                    {bodyComponent?.text && (
                      <p className="whitespace-pre-wrap">
                        {renderBold(
                          highlightVariables(
                            bodyComponent.text,
                            mode === "MANUAL" ? manualVariables.slice(headerCount, headerCount + bodyCount) : undefined,
                          ),
                        )}
                      </p>
                    )}
                    {footerComponent?.text && <p className="text-xs text-gray-500">{renderBold(footerComponent.text)}</p>}
                    <p className="text-right text-[10px] text-gray-500">
                      {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {buttonsComponent?.buttons?.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-center text-sm font-medium text-blue-600 shadow-md"
                    >
                      <Reply className="size-4" />
                      {b.text}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 text-sm">
                <div>
                  <Badge variant="outline" className="border-transparent bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                    {totalVars} variável{totalVars === 1 ? "" : "eis"} necessária{totalVars === 1 ? "" : "s"} por contato
                  </Badge>
                  {totalVars > 0 && (
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      {mode === "MANUAL"
                        ? "Preencha cada variável na ordem em que ela aparece na mensagem ao lado."
                        : 'Preencha uma coluna "variavelN" pra cada uma, no arquivo CSV importado abaixo.'}
                    </p>
                  )}
                </div>

                {mode === "MANUAL" && totalVars > 0 && (
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: totalVars }).map((_, i) => (
                      <div key={i} className="border-border rounded-lg border p-3">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                            {i + 1}
                          </span>
                          <Label htmlFor={`preview-var-${i}`} className="text-xs font-normal">
                            {i < headerCount ? "Header" : "Corpo"} · variável {i + 1}
                          </Label>
                        </div>
                        <Input
                          id={`preview-var-${i}`}
                          value={manualVariables[i] ?? ""}
                          onChange={(e) =>
                            setManualVariables((prev) => {
                              const next = [...prev];
                              next[i] = e.target.value;
                              return next;
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                {mode === "CSV" && (
                  <>
                    {headerCount > 0 && <p className="text-muted-foreground text-xs">Header: {headerCount} variável(is)</p>}
                    {bodyCount > 0 && <p className="text-muted-foreground text-xs">Corpo: {bodyCount} variável(is)</p>}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTemplate && (
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Users className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Contatos</CardTitle>
                <CardDescription>Informe quem vai receber o disparo — em massa (CSV) ou manual.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setMode("CSV")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  mode === "CSV" ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                )}
              >
                Importar CSV
              </button>
              <button
                type="button"
                onClick={() => setMode("MANUAL")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  mode === "MANUAL" ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                )}
              >
                Disparo manual
              </button>
            </div>

            {mode === "CSV" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="campaign-csv">Arquivo CSV (telefone obrigatório; nome, email e variáveis)</Label>
                    <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={downloadTemplate}>
                      <Download className="size-4" /> Baixar modelo CSV
                    </Button>
                  </div>
                  <label
                    htmlFor="campaign-csv"
                    className="border-primary/40 bg-primary/5 hover:bg-primary/10 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors"
                  >
                    <Upload className="text-primary size-6" />
                    <p className="text-muted-foreground text-sm">
                      {fileName ? fileName : "Clique para anexar o arquivo CSV."}
                    </p>
                    <input
                      id="campaign-csv"
                      type="file"
                      accept=".csv"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>

                {rows && rows.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-4 text-sm">
                      <span className="text-success flex items-center gap-1.5">
                        <CheckCircle2 className="size-4" /> {validRows.length} corretos
                      </span>
                      <span className="text-destructive flex items-center gap-1.5">
                        <XCircle className="size-4" /> {invalidRows.length} com erro
                      </span>
                    </div>

                    <div className="border-border max-h-80 overflow-y-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead className="text-left">Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r) => (
                            <TableRow key={r.index}>
                              <TableCell className="text-muted-foreground">{r.index}</TableCell>
                              <TableCell>{r.phone || "—"}</TableCell>
                              <TableCell className="text-left">{r.name || "—"}</TableCell>
                              <TableCell>{r.email || "—"}</TableCell>
                              <TableCell>
                                {r.errors.length === 0 ? (
                                  <Badge variant="success">Correto</Badge>
                                ) : (
                                  <span className="flex flex-col gap-0.5">
                                    <Badge variant="destructive">Erro</Badge>
                                    <span className="text-destructive text-xs">{r.errors.join(", ")}</span>
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-phone">Telefone</Label>
                  <PhoneInput id="manual-phone" value={manualPhone} onChange={setManualPhone} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-name">Nome (opcional)</Label>
                  <Input id="manual-name" value={manualName} onChange={(e) => setManualName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-email">Email (opcional)</Label>
                  <Input id="manual-email" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} />
                </div>
                {manualErrors.length > 0 && (
                  <p className="text-destructive text-xs sm:col-span-2">{manualErrors.join(", ")}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedTemplate && (
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Send className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Disparo</CardTitle>
                <CardDescription>Dê um nome à campanha e clique em disparar quando estiver tudo pronto.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campaign-name">Nome da campanha</Label>
              <Input
                id="campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Promoção de aniversário"
              />
            </div>

            {mode === "CSV" && (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="campaign-batch-size">Disparos por lote</Label>
                    <Input
                      id="campaign-batch-size"
                      type="number"
                      min={1}
                      step={1}
                      value={batchSize}
                      onChange={(e) => setBatchSize(e.target.value)}
                      placeholder="Ex: 10"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="campaign-batch-interval">Intervalo entre lotes (minutos)</Label>
                    <Input
                      id="campaign-batch-interval"
                      type="number"
                      min={1}
                      step={1}
                      value={batchIntervalMinutes}
                      onChange={(e) => setBatchIntervalMinutes(e.target.value)}
                      placeholder="Ex: 10"
                    />
                  </div>
                </div>
                {pacingValid && validRows.length > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    {validRows.length} contato(s) em {totalBatches} lote(s) de até {batchSizeNumber}, com {batchIntervalNumber}{" "}
                    min entre eles — duração estimada de {totalDurationMinutes} min. Você pode pausar a campanha a qualquer
                    momento pela tela de detalhes.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    O disparo em massa é enviado em lotes: informe quantos contatos por vez e quanto tempo esperar entre um
                    lote e o próximo.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={scheduleEnabled}
                  onCheckedChange={setScheduleEnabled}
                  className="data-[state=checked]:bg-success"
                />
                <div>
                  <Label>Agendar disparo</Label>
                  <p className="text-muted-foreground text-xs">Escolha a data e o horário em que a campanha deve começar.</p>
                </div>
              </div>
              {scheduleEnabled && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="campaign-scheduled-at">Início do disparo</Label>
                  <Input
                    id="campaign-scheduled-at"
                    type="datetime-local"
                    className="w-fit"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                  {scheduledAt && !scheduleValid && (
                    <p className="text-destructive text-xs">Escolha uma data e horário no futuro.</p>
                  )}
                </div>
              )}
            </div>

            {error &&<p className="text-destructive text-sm">{error}</p>}

            <Button type="button" disabled={!canSubmit} onClick={handleSubmit} className="w-fit gap-2">
              <FileSpreadsheet className="size-4" />
              {checkingBlocked
                ? "Verificando contatos…"
                : submitting
                  ? "Enviando..."
                  : scheduleEnabled
                    ? "Agendar campanha"
                    : "Disparar campanha"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
