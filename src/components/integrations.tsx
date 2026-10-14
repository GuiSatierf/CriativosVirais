"use client";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { api, savedSchema, formatCents } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CsvImport } from "./csv-import";
import { CopyButton } from "./copy-button";
const schema = z.array(
  z.object({
    provider: z.string(),
    status: z.string(),
    lastSyncAt: z.string().nullable(),
    metadata: z
      .object({
        warning: z.string().optional(),
        summary: z
          .object({
            ads: z.object({ spend: z.number().nullable().optional() }),
            result: z.object({ profit: z.number().nullable().optional() }),
            revenue: z.object({ gross: z.number().nullable().optional() }),
          })
          .optional(),
      })
      .nullable(),
  }),
);
export function Integrations() {
  const [rows, setRows] = useState<z.infer<typeof schema>>([]);
  const [apiKey, setApiKey] = useState("");
  const [dashboardId, setDashboardId] = useState("");
  const [pending, setPending] = useState(false);
  const [webhook, setWebhook] = useState<{
    url: string;
    token: string;
    secret: string;
  }>();
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const data = await api("/api/integrations", schema);
        if (!stopped) setRows(data);
      } catch {}
    };
    void poll();
    const timer = setInterval(poll, 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);
  const utm = rows.find((r) => r.provider === "utmify");
  const hook = rows.find((r) => r.provider === "webhook");
  async function action(fn: () => Promise<void>) {
    setPending(true);
    try {
      await fn();
      setRows(await api("/api/integrations", schema));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível concluir.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Integrações e métricas</h1>
      <Card>
        <CardHeader>
          <CardTitle>Importar CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <CsvImport />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>UTMify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A API oficial consulta o resumo consolidado do dashboard. O ranking
            por criativo precisa de CSV ou webhook com uma chave estável. O
            acesso depende de plano elegível e liberação do beta.
          </p>
          {utm && (
            <p className="text-sm">
              Estado: {utm.status} · Última sincronização:{" "}
              {utm.lastSyncAt
                ? new Date(utm.lastSyncAt).toLocaleString("pt-BR")
                : "Ainda não sincronizado"}
            </p>
          )}
          {utm?.metadata?.warning && (
            <p className="text-sm">{utm.metadata.warning}</p>
          )}
          {utm?.metadata?.summary && (
            <p className="text-sm">
              Resumo: receita{" "}
              {formatCents(
                utm.metadata.summary.revenue.gross == null
                  ? null
                  : String(utm.metadata.summary.revenue.gross),
              )}{" "}
              · gasto{" "}
              {formatCents(
                utm.metadata.summary.ads.spend == null
                  ? null
                  : String(utm.metadata.summary.ads.spend),
              )}{" "}
              · lucro{" "}
              {formatCents(
                utm.metadata.summary.result.profit == null
                  ? null
                  : String(utm.metadata.summary.result.profit),
              )}
            </p>
          )}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await api("/api/integrations", savedSchema, {
                  provider: "utmify",
                  apiKey,
                  dashboardId,
                });
                setApiKey("");
                toast.success("Chave salva. Sincronização enfileirada.");
              });
            }}
          >
            <Label htmlFor="utm-key">Chave de API</Label>
            <Input
              id="utm-key"
              type="password"
              autoComplete="new-password"
              name="utmify-api-key"
              value={apiKey}
              onInput={(e) => setApiKey(e.currentTarget.value)}
              required
              minLength={10}
            />
            <Label htmlFor="utm-dashboard">ID do dashboard</Label>
            <Input
              id="utm-dashboard"
              name="utmify-dashboard-id"
              autoComplete="off"
              value={dashboardId}
              onInput={(e) => setDashboardId(e.currentTarget.value)}
              required
              pattern="[a-fA-F0-9]{24}"
            />
            <Button type="submit" disabled={pending}>
              Conectar / atualizar chave
            </Button>
          </form>
          {utm && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  void action(async () => {
                    await api("/api/integrations/sync", savedSchema, {});
                    toast.success("Sincronização enfileirada.");
                  })
                }
              >
                Sincronizar agora
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  void action(async () => {
                    await api(
                      "/api/integrations",
                      savedSchema,
                      { provider: "utmify" },
                      "DELETE",
                    );
                  })
                }
              >
                Desconectar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Webhook de vendas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Envie eventos BRL com centavos inteiros. Use Authorization: Bearer
            token e X-Webhook-Signature: sha256=assinatura HMAC-SHA256 do corpo
            bruto, com o secret. event_id único por evento; pagamento e
            reembolso devem ter IDs diferentes.
          </p>
          <p className="text-sm text-muted-foreground">
            Token e secret são exibidos uma única vez ao gerar. Regenerar revoga
            a credencial anterior imediatamente.
          </p>
          <Button
            disabled={pending}
            onClick={() =>
              void action(async () => {
                setWebhook(
                  await api(
                    "/api/integrations",
                    z.object({
                      url: z.url(),
                      token: z.string(),
                      secret: z.string(),
                    }),
                    { provider: "webhook" },
                  ),
                );
              })
            }
          >
            {hook ? "Regenerar token e secret" : "Gerar conexão"}
          </Button>
          {hook && (
            <Button
              variant="outline"
              className="ml-3"
              disabled={pending}
              onClick={() =>
                void action(async () => {
                  await api(
                    "/api/integrations",
                    savedSchema,
                    { provider: "webhook" },
                    "DELETE",
                  );
                  setWebhook(undefined);
                })
              }
            >
              Revogar conexão
            </Button>
          )}
          {webhook && (
            <div className="space-y-3 rounded-md border p-4">
              <p className="break-all text-sm">URL: {webhook.url}</p>
              <CopyButton label="Copiar URL" text={webhook.url} />
              <Label>Token</Label>
              <Input readOnly type="password" value={webhook.token} />
              <CopyButton label="Copiar token" text={webhook.token} />
              <Label>Secret</Label>
              <Input readOnly type="password" value={webhook.secret} />
              <CopyButton label="Copiar secret" text={webhook.secret} />
              <Button variant="ghost" onClick={() => setWebhook(undefined)}>
                Ocultar credenciais
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>VK Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aguardando sua confirmação de uma API pública oficial. O conector
            permanece desabilitado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
