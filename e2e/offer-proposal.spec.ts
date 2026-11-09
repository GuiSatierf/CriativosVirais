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
