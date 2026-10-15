"use client";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  CircleAlert,
  FileUp,
  KeyRound,
  LoaderCircle,
  Plug,
  RefreshCw,
  RotateCw,
  Settings2,
  TriangleAlert,
  Unplug,
  EyeOff,
  Ban,
  Webhook,
} from "@/components/icons";
import {
  api,
  formatCents,
  formatDay,
  savedSchema,
  toastError,
} from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet } from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ConfirmButton,
  Details,
  IntegrationCard,
  IntegrationCardSkeleton,
  SetupSheetContent,
  StatusBadge,
  Step,
  Steps,
  formatDateTime,
  toStatus,
} from "@/components/integrations/shared";
import { CsvImport } from "./csv-import";
import { CopyButton } from "./copy-button";

const rowsSchema = z.array(
  z.object({
    provider: z.string(),
    status: z.string(),
    lastSyncAt: z.string().nullable(),
    metadata: z
      .object({
        summary: z
          .object({
            ads: z.object({ spend: z.number().nullable().optional() }),
            result: z.object({ profit: z.number().nullable().optional() }),
            revenue: z.object({ gross: z.number().nullable().optional() }),
          })
          .optional(),
      })
      .nullable()
      .catch(null),
  }),
);
type Rows = z.infer<typeof rowsSchema>;
type Row = Rows[number];
const webhookSchema = z.object({
  url: z.url(),
  token: z.string(),
  secret: z.string(),
});
type WebhookCredentials = z.infer<typeof webhookSchema>;
type Action = "connect" | "sync" | "disconnect" | "generate" | "revoke";
type Panel = "csv" | "utmify" | "webhook";
type Run = (
  name: Action,
  fn: () => Promise<void>,
  success: string,
) => Promise<void>;

const dashboardIdPattern = /^[a-fA-F0-9]{24}$/;
/** Stop polling a manual sync that never reports back. */
const syncPollLimit = 3 * 60_000;

export function Integrations({
  initialRows,
  initialCsvDay = null,
}: {
  initialRows?: unknown;
  /** Last day covered by CSV imports (YYYY-MM-DD), when any exist. */
  initialCsvDay?: string | null;
}) {
  const [rows, setRows] = useState<Rows | null>(
    () => rowsSchema.safeParse(initialRows).data ?? null,
  );
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  // The last panel stays rendered while the sheet animates closed.
  const [panel, setPanel] = useState<Panel>("csv");
  const [sheetOpen, setSheetOpen] = useState(false);
  const openPanel = (next: Panel) => {
    setPanel(next);
    setSheetOpen(true);
  };
  const [csvDay, setCsvDay] = useState(initialCsvDay);
  // Kept here so closing the sheet does not lose credentials shown only once.
  const [webhook, setWebhook] = useState<WebhookCredentials>();
  /** lastSyncAt seen when a manual sync was requested, until a new one lands. */
  const [syncRequest, setSyncRequest] = useState<{
    lastSyncAt: string | null;
    since: number;
  } | null>(null);

  const utm = rows?.find((r) => r.provider === "utmify");
  const hook = rows?.find((r) => r.provider === "webhook");

  const refresh = useCallback(async () => {
    try {
      setRows(await api("/api/integrations", rowsSchema));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // Fallback when the server could not provide the initial rows.
    if (rows !== null) return;
    let active = true;
    api("/api/integrations", rowsSchema).then(
      (data) => active && setRows(data),
      () => active && setLoadError(true),
    );
    return () => {
      active = false;
    };
    // Initial load only; later refreshes are explicit or polled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A manual sync is done once lastSyncAt changes or the sync fails.
  const manualSyncPending =
    syncRequest !== null &&
    utm !== undefined &&
    utm.status !== "error" &&
    utm.lastSyncAt === syncRequest.lastSyncAt;
  const syncing = utm?.status === "pending" || manualSyncPending;
  useEffect(() => {
    if (!syncing) return;
    const timer = setInterval(() => {
      if (syncRequest && Date.now() - syncRequest.since > syncPollLimit)
        setSyncRequest(null);
      else void refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [syncing, syncRequest, refresh]);

  const run: Run = async (name, fn, success) => {
    setBusy(name);
    try {
      await fn();
    } catch (error) {
      toastError(error);
      return;
    } finally {
      setBusy(null);
    }
    toast.success(success);
    await refresh();
  };

  const utmBusy =
    busy === "connect" || busy === "sync" || busy === "disconnect";
  const hookBusy = busy === "generate" || busy === "revoke";

  function sync() {
    if (!utm) return;
    void run(
      "sync",
      async () => {
        await api("/api/integrations/sync", savedSchema, {});
        setSyncRequest({ lastSyncAt: utm.lastSyncAt, since: Date.now() });
      },
      "Sincronização iniciada.",
    );
  }

  const syncButton = (
    <Button
      variant="ghost"
      size="sm"
      disabled={utmBusy || syncing}
      onClick={sync}
    >
      <RefreshCw aria-hidden className={syncing ? "animate-spin" : undefined} />
      {busy === "sync" || syncing ? "Sincronizando…" : "Sincronizar agora"}
    </Button>
  );

  const utmStatus = toStatus(utm?.status);
  const hookStatus = toStatus(hook?.status);

  return (
    <div className="space-y-4">
      {loadError && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>Não foi possível consultar suas conexões.</AlertTitle>
          <AlertDescription>
            <Button
              variant="link"
              className="h-auto min-h-0 p-0"
              onClick={() => void refresh()}
            >
              <RotateCw aria-hidden />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <IntegrationCard
          title="Planilha CSV"
          description="Importe resultados de uma planilha."
          meta={csvDay ? `Dados até ${formatDay(csvDay)}` : undefined}
        >
          <Button
            variant={csvDay ? "outline" : "default"}
            onClick={() => openPanel("csv")}
          >
            <FileUp aria-hidden />
            Importar planilha
          </Button>
        </IntegrationCard>

        {rows === null ? (
          <>
            <span role="status" className="sr-only">
              Carregando conexões…
            </span>
            <IntegrationCardSkeleton />
            <IntegrationCardSkeleton />
          </>
        ) : (
          <>
            <IntegrationCard
              title="UTMify"
              description="Receita e investimento do seu dashboard."
              badge={
                utm && (
                  <StatusBadge
                    status={syncing ? "pending" : utmStatus}
                    label={syncing ? "Sincronizando" : undefined}
                  />
                )
              }
              meta={
                utm &&
                (utm.lastSyncAt
                  ? `Sincronizada em ${formatDateTime(utm.lastSyncAt)}`
                  : utmStatus === "error"
                    ? "A sincronização falhou"
                    : "Primeira sincronização em andamento")
              }
            >
              <Button
                variant={utm ? "outline" : "default"}
                onClick={() => openPanel("utmify")}
              >
                {utm ? <Settings2 aria-hidden /> : <Plug aria-hidden />}
                {utm ? "Gerenciar" : "Conectar"}
              </Button>
              {utm && syncButton}
            </IntegrationCard>

            <IntegrationCard
              title="Webhook de vendas"
              description="Vendas do seu checkout em tempo real."
              badge={hook && <StatusBadge status={hookStatus} />}
              meta={
                webhook
                  ? "Copie o token e o secret antes de sair."
                  : hook && "Pronta para receber vendas."
              }
            >
              <Button
                variant={hook ? "outline" : "default"}
                onClick={() => openPanel("webhook")}
              >
                {hook ? <Settings2 aria-hidden /> : <Webhook aria-hidden />}
                {hook ? "Gerenciar" : "Configurar"}
              </Button>
            </IntegrationCard>
          </>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {panel === "csv" && (
          <SetupSheetContent
            title="Importar planilha"
            description="Uma linha por criativo. Só o código do criativo é obrigatório."
          >
            <CsvImport
              onImported={(to) => {
                setCsvDay((day) => (day && day > to ? day : to));
                setSheetOpen(false);
              }}
            />
          </SetupSheetContent>
        )}
        {panel === "utmify" && (
          <SetupSheetContent
            title="UTMify"
            description="Receita, investimento e lucro do dashboard, sem separar por criativo."
          >
            <UtmifyPanel
              utm={utm}
              busy={busy}
              utmBusy={utmBusy}
              syncing={syncing}
              syncButton={syncButton}
              run={run}
              onDisconnected={() => setSheetOpen(false)}
            />
          </SetupSheetContent>
        )}
        {panel === "webhook" && (
          <SetupSheetContent
            title="Webhook de vendas"
            description="Seu checkout envia cada venda, com o criativo que a gerou."
          >
            <WebhookPanel
              hook={hook}
              busy={busy}
              hookBusy={hookBusy}
              webhook={webhook}
              setWebhook={setWebhook}
              run={run}
            />
          </SetupSheetContent>
        )}
      </Sheet>
    </div>
  );
}

function UtmifyPanel({
  utm,
  busy,
  utmBusy,
  syncing,
  syncButton,
  run,
  onDisconnected,
}: {
  utm: Row | undefined;
  busy: Action | null;
  utmBusy: boolean;
  syncing: boolean;
  syncButton: React.ReactNode;
  run: Run;
  onDisconnected: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [dashboardId, setDashboardId] = useState("");
  const [dashboardIdError, setDashboardIdError] = useState(false);
  const summary = utm?.metadata?.summary;
  const status = toStatus(utm?.status);

  const form = (
    <form
      className="space-y-6"
      aria-busy={busy === "connect"}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const formElement = e.currentTarget;
        if (!dashboardIdPattern.test(dashboardId.trim())) {
          setDashboardIdError(true);
          formElement
            .querySelector<HTMLInputElement>("#utm-dashboard")
            ?.focus();
          return;
        }
        if (!formElement.reportValidity()) return;
        void run(
          "connect",
          async () => {
            await api("/api/integrations", savedSchema, {
              provider: "utmify",
              apiKey,
              dashboardId: dashboardId.trim(),
            });
            setApiKey("");
          },
          "UTMify conectada. A primeira sincronização já começou.",
        );
      }}
    >
      <Steps>
        <Step number={1} title="Abra a UTMify">
          <p className="text-xs text-muted-foreground">
            Na sua conta, abra a área de API e crie uma chave.
          </p>
        </Step>
        <Step number={2} title="Cole a chave de API">
          <div className="space-y-1.5">
            <Label htmlFor="utm-key" className="sr-only">
              Chave de API
            </Label>
            <PasswordInput
              id="utm-key"
              autoComplete="new-password"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="next"
              name="utmify-api-key"
              placeholder="Chave de API"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              minLength={10}
              maxLength={500}
            />
          </div>
        </Step>
        <Step number={3} title="Cole o ID do dashboard">
          <div className="space-y-1.5">
            <Label htmlFor="utm-dashboard" className="sr-only">
              ID do dashboard
            </Label>
            <Input
              id="utm-dashboard"
              name="utmify-dashboard-id"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder="ID do dashboard"
              className="font-mono"
              value={dashboardId}
              onChange={(e) => {
                setDashboardId(e.target.value);
                setDashboardIdError(false);
              }}
              required
              aria-describedby={
                dashboardIdError
                  ? "utm-dashboard-hint utm-dashboard-error"
                  : "utm-dashboard-hint"
              }
              aria-invalid={dashboardIdError || undefined}
            />
            <p
              id="utm-dashboard-hint"
              className="text-xs text-muted-foreground"
            >
              Código de 24 caracteres no endereço do dashboard.
            </p>
            {dashboardIdError && (
              <p id="utm-dashboard-error" className="text-xs text-destructive">
                Use os 24 caracteres do ID, só números e letras de a a f.
              </p>
            )}
          </div>
        </Step>
      </Steps>
      <Button type="submit" className="w-full sm:w-auto" disabled={utmBusy}>
        {busy === "connect" ? (
          <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <Plug aria-hidden />
        )}
        {busy === "connect"
          ? "Conectando…"
          : utm
            ? "Atualizar conexão"
            : "Conectar UTMify"}
      </Button>
    </form>
  );

  if (!utm) return <div className="px-6 py-6">{form}</div>;

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge
            status={syncing ? "pending" : status}
            label={syncing ? "Sincronizando" : undefined}
          />
          <p className="text-xs text-muted-foreground">
            {utm.lastSyncAt
              ? `Sincronizada em ${formatDateTime(utm.lastSyncAt)}`
              : "Ainda não sincronizou"}
          </p>
        </div>
        {status === "error" && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertTitle>A última sincronização falhou.</AlertTitle>
            <AlertDescription>
              Confira a chave e o ID do dashboard abaixo e conecte de novo.
            </AlertDescription>
          </Alert>
        )}
        {summary && (
          <dl className="grid grid-cols-3 gap-3 text-sm">
            {(
              [
                ["Receita", summary.revenue.gross],
                ["Investimento", summary.ads.spend],
                ["Lucro", summary.result.profit],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0 space-y-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="truncate font-medium tabular-nums">
                  {formatCents(value ?? null)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex flex-wrap gap-2">
          {syncButton}
          <ConfirmButton
            variant="ghost"
            icon={Unplug}
            label="Desconectar"
            pendingLabel="Desconectando…"
            title="Desconectar a UTMify?"
            description="A chave de API será apagada e os resumos da UTMify param de ser atualizados. Para voltar, você vai precisar informar a chave de novo."
            confirmLabel="Desconectar"
            pending={busy === "disconnect"}
            disabled={utmBusy}
            onConfirm={() =>
              void run(
                "disconnect",
                async () => {
                  await api(
                    "/api/integrations",
                    savedSchema,
                    { provider: "utmify" },
                    "DELETE",
                  );
                  onDisconnected();
                },
                "UTMify desconectada.",
              )
            }
          />
        </div>
      </div>
      <Separator />
      <Details
        label="Trocar chave ou dashboard"
        defaultOpen={status === "error"}
      >
        <div className="pt-3">{form}</div>
      </Details>
    </div>
  );
}

function WebhookPanel({
  hook,
  busy,
  hookBusy,
  webhook,
  setWebhook,
  run,
}: {
  hook: Row | undefined;
  busy: Action | null;
  hookBusy: boolean;
  webhook: WebhookCredentials | undefined;
  setWebhook: (value: WebhookCredentials | undefined) => void;
  run: Run;
}) {
  const generate = (success: string) =>
    void run(
      "generate",
      async () =>
        setWebhook(
          await api("/api/integrations", webhookSchema, {
            provider: "webhook",
          }),
        ),
      success,
    );

  return (
    <div className="space-y-6 px-6 py-6">
      {webhook ? (
        <div className="space-y-5">
          <Alert>
            <TriangleAlert aria-hidden />
            <AlertTitle>Copie agora</AlertTitle>
            <AlertDescription>
              O token e o secret aparecem uma única vez.
            </AlertDescription>
          </Alert>
          {(
            [
              ["webhook-url", "URL", webhook.url, "text"],
              ["webhook-token", "Token", webhook.token, "password"],
              ["webhook-secret", "Secret", webhook.secret, "password"],
            ] as const
          ).map(([id, label, value, type]) => (
            <div key={id} className="space-y-1.5">
              <Label htmlFor={id}>{label}</Label>
              <div className="flex gap-2">
                <Input
                  id={id}
                  readOnly
                  type={type}
                  // Read-only secrets: password managers must not offer to save them.
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  value={value}
                  spellCheck={false}
                  autoCapitalize="off"
                  className="font-mono text-base md:text-xs"
                />
                <CopyButton
                  iconOnly
                  label={`Copiar ${label.toLowerCase()}`}
                  text={value}
                />
              </div>
            </div>
          ))}
          <ConfirmButton
            icon={EyeOff}
            label="Ocultar credenciais"
            title="Ocultar as credenciais?"
            description="Você copiou o token e o secret? Eles não serão exibidos novamente."
            confirmLabel="Já copiei, ocultar"
            destructive={false}
            onConfirm={() => setWebhook(undefined)}
          />
        </div>
      ) : hook ? (
        <div className="space-y-3">
          <StatusBadge status={toStatus(hook.status)} />
          <p className="text-sm text-muted-foreground">
            O token e o secret não aparecem de novo; se perdeu, gere novos.
          </p>
        </div>
      ) : (
        <Steps>
          <Step number={1} title="Gere a conexão">
            <Button
              disabled={hookBusy}
              onClick={() =>
                generate("Conexão gerada. Copie o token e o secret agora.")
              }
            >
              {busy === "generate" ? (
                <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <KeyRound aria-hidden />
              )}
              {busy === "generate" ? "Gerando…" : "Gerar conexão"}
            </Button>
          </Step>
          <Step
            number={2}
            title="Passe os dados para quem configura seu checkout"
            muted
          >
            <p className="text-xs text-muted-foreground">
              A URL, o token e o secret aparecem aqui depois do passo 1.
            </p>
          </Step>
        </Steps>
      )}

      {hook && (
        <div className="flex flex-wrap gap-2">
          <ConfirmButton
            icon={RefreshCw}
            label="Gerar novo token e secret"
            pendingLabel="Gerando…"
            title="Gerar novo token e secret?"
            description="O token e o secret atuais param de funcionar na hora. A integração vai parar de receber vendas até você configurar o novo token."
            confirmLabel="Gerar novos"
            pending={busy === "generate"}
            disabled={hookBusy}
            onConfirm={() =>
              generate(
                "Novo token e secret gerados. Copie antes de sair da página.",
              )
            }
          />
          <ConfirmButton
            variant="ghost"
            icon={Ban}
            label="Revogar conexão"
            pendingLabel="Revogando…"
            title="Revogar o webhook?"
            description="As vendas enviadas para esta URL deixam de ser recebidas. As vendas já registradas continuam nos relatórios."
            confirmLabel="Revogar"
            pending={busy === "revoke"}
            disabled={hookBusy}
            onConfirm={() =>
              void run(
                "revoke",
                async () => {
                  await api(
                    "/api/integrations",
                    savedSchema,
                    { provider: "webhook" },
                    "DELETE",
                  );
                  setWebhook(undefined);
                },
                "Webhook revogado.",
              )
            }
          />
        </div>
      )}

      <Separator />
      <Details label="Para quem vai configurar">
        <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li>Envie um POST em JSON para a URL da conexão.</li>
          <li>
            Cabeçalho <code>Authorization: Bearer &lt;token&gt;</code>.
          </li>
          <li>
            Cabeçalho{" "}
            <code>X-Webhook-Signature: sha256=&lt;assinatura&gt;</code>, com a
            assinatura HMAC-SHA256 do corpo bruto usando o secret.
          </li>
          <li>Valores em BRL, em centavos inteiros.</li>
          <li>
            <code>event_id</code> único por evento; pagamento e reembolso
            precisam de IDs diferentes.
          </li>
        </ul>
      </Details>
    </div>
  );
}
