import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardMetrics } from "./data-table";

const items = [
  { label: "Investimento", value: "R$ 450,00" },
  { label: "Vendas", value: "9" },
];
const more = [
  { label: "Impressões", value: "38.000" },
  { label: "Cliques", value: "920" },
  { label: "Lucro", value: "R$ 1.323,00" },
  { label: "Leads", value: null },
];

describe("mobile metric card", () => {
  it("offers the extra metrics that have a value behind a button", () => {
    const html = renderToStaticMarkup(createElement(CardMetrics, { items, more }));
    expect(html).toContain("Ver mais 3 métricas");
    // Collapsed by default: the main metrics show, the extra ones wait for the click.
    expect(html).toContain("Investimento");
    expect(html).not.toContain("Impressões");
  });

  it("shows no button when no extra metric has a value", () => {
    const html = renderToStaticMarkup(createElement(CardMetrics, { items, more: [{ label: "Leads", value: null }] }));
    expect(html).not.toContain("Ver mais");
  });
});
