import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, batches, integrations } from "@/db/schema";
import { getOnboarding } from "./onboarding";
import { tenantWhere } from "./tenant-scope";

export type HomeIcon =
  | "offer"
  | "csv"
  | "scripts"
  | "video"
  | "results"
  | "batches"
  | "integrations";
export type HomeAction =
  | { type: "prompt"; text: string }
  | { type: "link"; href: string }
  | { type: "attach"; kind: "video" | "csv" };
export type HomeSuggestion = {
  id: string;
  title: string;
  description: string;
  icon: HomeIcon;
  action: HomeAction;
};
export type HomeStatus = { id: string; label: string; href: string; tone: "info" | "warning" };
export type Home = {
  status: HomeStatus[];
  suggestions: HomeSuggestion[];
  /** The offer is still unknown: the hero opens with the mandated question. */
  firstContact: boolean;
};

const integrationNames: Record<string, string> = {
  utmify: "UTMify",
  webhook: "Webhook de vendas",
  vkmetrics: "VK Metrics",
};

/**
 * What the hero shows: a status line with news worth acting on and the next
 * best actions for this account. Plain queries, no model calls.
 */
export async function getHome(tenantId: string): Promise<Home> {
  const [onboarding, videos, broken, [withResults]] = await Promise.all([
    getOnboarding(tenantId),
    db
      .select({ status: assets.status, count: sql<number>`count(*)::int` })
      .from(assets)
      .where(
        tenantWhere(
          assets,
          tenantId,
          eq(assets.kind, "video"),
          isNotNull(assets.uploadCompletedAt),
          isNotNull(assets.creativeId),
          inArray(assets.status, ["uploaded", "processing", "error"]),
        ),
      )
      .groupBy(assets.status),
    db
      .select({ provider: integrations.provider })
      .from(integrations)
      .where(tenantWhere(integrations, tenantId, eq(integrations.status, "error"))),
    db
      .select({ id: batches.id, title: batches.title })
      .from(batches)
      .where(
        and(
          tenantWhere(batches, tenantId, isNull(batches.archivedAt)),
          sql`EXISTS (SELECT 1 FROM batch_items bi
            JOIN creatives c ON c.tenant_id = bi.tenant_id
              AND c.creative_key = bi.creative_key
            JOIN creative_metrics cm ON cm.tenant_id = c.tenant_id
              AND cm.creative_id = c.id
            WHERE bi.tenant_id = ${batches.tenantId}
              AND bi.batch_id = ${batches.id})`,
        ),
      )
      .orderBy(desc(batches.createdAt))
      .limit(1),
  ]);

  const status: HomeStatus[] = [];
  const analysing = videos
    .filter((v) => v.status !== "error")
    .reduce((sum, v) => sum + v.count, 0);
  const failed = videos.find((v) => v.status === "error")?.count ?? 0;
  if (analysing)
    status.push({
      id: "analysing",
      label: analysing === 1 ? "1 vídeo em análise" : `${analysing} vídeos em análise`,
      href: "/criativos",
      tone: "info",
    });
  if (failed)
    status.push({
      id: "failed",
      label: failed === 1 ? "1 vídeo não foi analisado" : `${failed} vídeos não foram analisados`,
      href: "/criativos",
      tone: "warning",
    });
  for (const { provider } of broken)
    status.push({
      id: `integration-${provider}`,
      label: `${integrationNames[provider] ?? "Integração"} precisa de atenção`,
      href: "/integracoes",
      tone: "warning",
    });
  if (withResults)
    status.push({
      id: "results",
      // "Leva 03 · Produto · 14/10/2026" reads as "Leva 03" in the chip.
      label: `${withResults.title.split(" · ")[0]} já tem resultados`,
      href: `/levas/${withResults.id}`,
      tone: "info",
    });

  const all: (HomeSuggestion | false)[] = [
    !onboarding.context && {
      id: "offer",
      title: "Contar sobre minha oferta",
      description: "O Estrategista pergunta, você responde",
      icon: "offer",
      action: { type: "prompt", text: "Quero te contar sobre a minha oferta." },
    },
    !onboarding.results && {
      id: "csv",
      title: "Importar planilha",
      description: "O CSV do Gerenciador de Anúncios",
      icon: "csv",
      action: { type: "attach", kind: "csv" },
    },
    onboarding.context && {
      id: "scripts",
      title: "Criar uma leva",
      description: "Roteiros prontos para gravar",
      icon: "scripts",
      action: { type: "prompt", text: "Crie uma leva de roteiros para o meu produto." },
    },
    {
      id: "video",
      title: "Analisar um vídeo",
      description: "Envie um anúncio que já rodou",
      icon: "video",
      action: { type: "attach", kind: "video" },
    },
    onboarding.results && {
      id: "results",
      title: "Ver o que funcionou",
      description: "Ganchos e criativos que mais venderam",
      icon: "results",
      action: { type: "prompt", text: "Quais ganchos funcionaram melhor nos meus criativos?" },
    },
    onboarding.batch && {
      id: "batches",
      title: "Minhas levas",
      description: "Roteiros que você já gerou",
      icon: "batches",
      action: { type: "link", href: "/levas" },
    },
    !onboarding.results && {
      id: "integrations",
      title: "Conectar vendas",
      description: "UTMify ou webhook do checkout",
      icon: "integrations",
      action: { type: "link", href: "/integracoes" },
    },
  ];
  return {
    firstContact: !onboarding.context,
    status,
    suggestions: all.filter((s): s is HomeSuggestion => Boolean(s)).slice(0, 4),
  };
}
