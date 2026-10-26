"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Copy } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Spinner, useAction } from "./access-dialogs";
import { AdminHeading, type AdminNavigation } from "./admin-heading";

export type AccessEndPolicy = "immediate" | "end_of_period";
export type PanelSettings = {
  hotmart: { configured: boolean; hasHottok: boolean; productIds: string[]; webhookUrl: string };
  aiMonthlyLimitCents: number;
  accessEndPolicy: AccessEndPolicy;
};

const savedSchema = z.object({ saved: z.boolean() });
const productIdPattern = /^\d{1,20}$/;
// "20", "20,00" or "R$ 1.250,50"; dots are thousands separators, as people type in Brazil.
const reaisPattern = /^(\d{1,5})(?:,(\d{1,2}))?$/;
const minAiLimitCents = 100;

function saveSettings(body: Record<string, unknown>) {
  return api("/api/admin/settings", savedSchema, body, "PUT");
}

function reaisLabel(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Cents typed as reais, or null when the text is not an amount. */
export function centsFromReais(text: string) {
  const match = reaisPattern.exec(text.replace(/R\$|\s|\./g, ""));
  if (match == null) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"));
}

function SettingsCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="section-title">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

function FieldError({ error }: { error: string | null }) {
  if (error == null) return null;
  return <p role="alert" className="text-sm text-destructive">{error}</p>;
}

function HotmartStatus({ configured }: { configured: boolean }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5", configured ? "text-success" : "text-warning")}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {configured ? "Configurada" : "Ainda não configurada"}
    </Badge>
  );
}

function WebhookAddress({ url }: { url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Endereço copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o endereço e copie.");
    }
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="hotmart-webhook">Endereço para cadastrar na Hotmart</Label>
      <div className="flex items-start gap-2">
        <Input id="hotmart-webhook" readOnly value={url} className="min-w-0 flex-1" onFocus={(event) => event.currentTarget.select()} />
        <Button type="button" variant="outline" onClick={copy}>
          <Copy aria-hidden />
          Copiar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Na Hotmart: Ferramentas → Webhook → Cadastrar, versão 2.0.0, com compra aprovada, compra completa, reembolso, chargeback e cancelamento de assinatura.
      </p>
    </div>
  );
}

function HotmartCard({ hotmart }: { hotmart: PanelSettings["hotmart"] }) {
  const hottokInput = useRef<HTMLInputElement>(null);
  // The saved hottok must not stay typed on screen.
  const { pending, error, setError, run } = useAction(() => {
    if (hottokInput.current != null) hottokInput.current.value = "";
  });
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const hottok = String(form.get("hottok") ?? "").trim();
    const productIds = String(form.get("productIds") ?? "");
    const ids = productIds.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
    if (hottok.length === 0 && hotmart.hasHottok === false) return setError("Cole o hottok da Hotmart.");
    if (ids.length === 0 || ids.some((id) => productIdPattern.test(id) === false))
      return setError("Informe os números dos produtos, só com algarismos, separados por vírgula.");
    await run(() => saveSettings({ section: "hotmart", hottok, productIds }), "Hotmart salva.");
  }
  return (
    <SettingsCard title="Hotmart" badge={<HotmartStatus configured={hotmart.configured} />}>
      <p className="text-sm text-muted-foreground">
        Com isso, quem compra o Criativos Virais na Hotmart já consegue criar a conta, e reembolso ou chargeback bloqueiam o acesso sozinhos.
      </p>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="hotmart-hottok">Hottok</Label>
          <PasswordInput
            ref={hottokInput}
            id="hotmart-hottok"
            name="hottok"
            autoComplete="off"
            placeholder={hotmart.hasHottok ? "Salvo. Deixe em branco para manter." : "Cole aqui o hottok da Hotmart"}
          />
          <p className="text-xs text-muted-foreground">
            Na Hotmart: Ferramentas → Webhook → Autenticação. Depois de salvo, ele não aparece de novo.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hotmart-products">Números dos produtos</Label>
          <Input
            id="hotmart-products"
            name="productIds"
            inputMode="numeric"
            placeholder="Ex.: 1234567, 7654321"
            defaultValue={hotmart.productIds.join(", ")}
          />
          <p className="text-xs text-muted-foreground">Só compras desses produtos liberam acesso. Separe por vírgula se tiver mais de um.</p>
        </div>
        <WebhookAddress url={hotmart.webhookUrl} />
        <FieldError error={error} />
        <div>
          <Button type="submit" disabled={pending}>
            <Spinner pending={pending} />
            Salvar Hotmart
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

function AiLimitCard({ cents }: { cents: number }) {
  const { pending, error, setError, run } = useAction(() => undefined);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const limit = centsFromReais(String(new FormData(event.currentTarget).get("limit") ?? ""));
    if (limit == null || limit < minAiLimitCents) return setError("Informe um valor a partir de R$ 1,00, como 20,00.");
    await run(() => saveSettings({ section: "ai-limit", cents: limit }), "Limite de IA salvo.");
  }
  return (
    <SettingsCard title="Limite de IA por cliente">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="ai-limit">Gasto máximo por mês</Label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input id="ai-limit" name="limit" inputMode="decimal" defaultValue={reaisLabel(cents)} className="pl-9" />
          </div>
          <p className="text-xs text-muted-foreground">
            Quando o cliente passa do limite, o Estrategista para de responder até o dia 1º do mês seguinte. Vale para todos os clientes.
          </p>
        </div>
        <FieldError error={error} />
        <div>
          <Button type="submit" disabled={pending}>
            <Spinner pending={pending} />
            Salvar limite
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

const policies: { value: AccessEndPolicy; title: string; extra?: string; description: string }[] = [
  {
    value: "immediate",
    title: "Bloquear na hora",
    extra: "(recomendado)",
    description: "Reembolso, chargeback ou cancelamento tiram o acesso no mesmo instante.",
  },
  {
    value: "end_of_period",
    title: "Manter até o fim do período pago",
    description: "Só para assinatura: quem cancela usa até a data já paga. Reembolso e chargeback continuam bloqueando na hora.",
  },
];

function AccessEndCard({ policy }: { policy: AccessEndPolicy }) {
  const [selected, setSelected] = useState(policy);
  const { pending, error, run } = useAction(() => undefined);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => saveSettings({ section: "access-end", policy: selected }), "Opção salva.");
  }
  return (
    <SettingsCard title="Quando o acesso termina">
      <form onSubmit={submit} className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="sr-only">Quando o acesso termina</legend>
          {policies.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors duration-(--duration-fast)",
                selected === option.value ? "border-foreground" : "hover:border-foreground/40",
              )}
            >
              <input
                type="radio"
                name="policy"
                value={option.value}
                checked={selected === option.value}
                onChange={() => setSelected(option.value)}
                className="mt-0.5 size-4 flex-none accent-foreground"
              />
              <span>
                <span className="font-medium">{option.title}</span> {option.extra}
                <span className="block text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <FieldError error={error} />
        <div>
          <Button type="submit" disabled={pending}>
            <Spinner pending={pending} />
            Salvar
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

/** Owner-only settings: Hotmart, the AI limit per client and what a cancelled subscription does. */
export function SettingsPanel({ settings, navigation }: { settings: PanelSettings; navigation: AdminNavigation }) {
  return (
    <div className="space-y-5">
      <AdminHeading navigation={navigation} current="configuracoes" />
      <HotmartCard hotmart={settings.hotmart} />
      <AiLimitCard cents={settings.aiMonthlyLimitCents} />
      <AccessEndCard policy={settings.accessEndPolicy} />
      <p className="text-xs text-muted-foreground">Só donos veem esta aba. Toda alteração fica registrada com quem fez e quando.</p>
    </div>
  );
}
