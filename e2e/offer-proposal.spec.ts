import { expect, test, type Page } from "@playwright/test";
import { sendMessage, signUp } from "./support";

const savedOffer = async (page: Page) =>
  (await (await page.request.get("/api/context")).json()) as {
    ticketCents: string | null;
    provasAutorizadas: string[] | null;
  };

// The assistant used to save price and proofs on its own; they now wait for the client's confirmation.
test("price and proofs reach the offer only after the client confirms them", async ({ page }) => {
  await signUp(page);
  await sendMessage(page, "Eu vendo um curso de rotina para mães que trabalham fora.");
  const card = page.getByRole("region", { name: "Confira antes de eu usar nos roteiros" });
  await expect(card.getByText("R$ 197,00")).toBeVisible();
  await expect(card.getByText("Mais de 1.200 alunas formadas desde 2024")).toBeVisible();

  const before = await savedOffer(page);
  expect(before.ticketCents).toBeNull();
  expect(before.provasAutorizadas ?? []).toEqual([]);

  await card.getByRole("button", { name: "Confirmar e salvar" }).click();
  await expect(page.getByText(/Confirmado em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();

  const after = await savedOffer(page);
  expect(after.ticketCents).toBe("19700");
  expect(after.provasAutorizadas).toEqual(["Mais de 1.200 alunas formadas desde 2024"]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Preço e provas salvos na sua oferta" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar e salvar" })).toHaveCount(0);
});

// "Não usar" lived only on the screen, so the same card asked again after a reload.
test("a card the client set aside stays set aside after a reload", async ({ page }) => {
  await signUp(page);
  await sendMessage(page, "Eu vendo um curso de rotina para mães que trabalham fora.");
  await page.getByRole("button", { name: "Não usar" }).click();

  await page.reload();

  await expect(page.getByText("Não usado")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar e salvar" })).toHaveCount(0);
});

// An older card that a newer proposal replaced could be confirmed again and write the old values back.
test("only the newest proposal can be confirmed", async ({ page }) => {
  await signUp(page);
  await sendMessage(page, "Eu vendo um curso de rotina para mães que trabalham fora.");
  await sendMessage(page, "Corrigindo: eu vendo o curso de rotina por outro preço.");

  await page.reload();

  await expect(page.getByText("Substituído")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Confirmar e salvar" })).toHaveCount(1);
});
