import type { metricNames } from "@/lib/connectors/types";

export type MetricName = (typeof metricNames)[number];

/** Plain pt-BR labels and one-sentence explanations shown in the UI. */
export const metricText: Record<
  MetricName,
  { label: string; description: string }
> = {
  spend_cents: {
    label: "Investimento",
    description: "Quanto foi gasto em anúncios com o criativo.",
  },
  impressions: {
    label: "Impressões",
    description: "Quantas vezes o anúncio apareceu para alguém.",
  },
  clicks: {
    label: "Cliques",
    description: "Quantas vezes alguém clicou no anúncio.",
  },
  ctr: {
    label: "Taxa de cliques",
    description: "Porcentagem das impressões que viraram clique (CTR).",
  },
  hook_rate: {
    label: "Retenção no início",
    description:
      "Porcentagem de pessoas que continuaram assistindo depois dos primeiros segundos do vídeo (Hook Rate).",
  },
  body_rate: {
    label: "Retenção no meio",
    description:
      "Porcentagem de pessoas que passaram do início e continuaram assistindo o restante do vídeo (Body Rate).",
  },
  leads: {
    label: "Cadastros",
    description: "Pessoas que deixaram o contato depois do anúncio.",
  },
  checkouts: {
    label: "Inícios de compra",
    description: "Pessoas que chegaram à página de pagamento.",
  },
  approved_sales: {
    label: "Vendas",
    description: "Vendas com pagamento aprovado.",
  },
  revenue_cents: {
    label: "Receita",
    description: "Valor total das vendas aprovadas.",
  },
  profit_cents: {
    label: "Lucro",
    description: "Receita menos o investimento e os custos informados.",
  },
  roas: {
    label: "Retorno",
    description:
      "Quanto voltou de receita para cada R$ 1 investido (ROAS). \"R$ 2,00 por R$ 1\" significa que a receita foi o dobro do investimento.",
  },
  refunds: {
    label: "Reembolsos",
    description: "Vendas devolvidas a pedido do cliente.",
  },
  chargebacks: {
    label: "Contestações no cartão",
    description:
      "Compras canceladas pelo cliente junto ao banco ou à operadora do cartão (chargeback).",
  },
};
