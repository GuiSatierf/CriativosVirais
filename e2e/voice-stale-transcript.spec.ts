import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// A transcription that finishes after the person already sent a message belongs to that round:
// it must not refill the composer ("E aí Qual dos três roteiros vendeu mais? E aí").
// Storage and transcription are simulated, so the test needs neither the bucket nor Whisper.
test("a transcription that arrives after a send stays out of the composer", async ({ page }) => {
  const assetId = randomUUID();
  await page.route("**/api/uploads/presign", (route) =>
    route.fulfill({ json: { url: new URL("/e2e-simulated-upload", route.request().url()).href, assetId } }),
  );
  await page.route("**/e2e-simulated-upload", (route) => route.fulfill({ status: 200 }));
  await page.route("**/api/uploads/complete", (route) =>
    route.fulfill({ status: 202, json: { assetId, status: "uploaded" } }),
  );
  let transcribed = false;
  await page.route(`**/api/assets/${assetId}`, (route) =>
    route.fulfill({
      json: transcribed
        ? { id: assetId, status: "done", kind: "audio", error: null, transcription: { text: "E aí" } }
        : { id: assetId, status: "processing", kind: "audio", error: null, transcription: null },
    }),
  );

  await signUp(page);
  await page.getByRole("button", { name: "Anexar vídeo ou áudio" }).click();
  await page
    .locator("#chat-attachments input[type=file]")
    .nth(1)
    .setInputFiles({ name: "nota.webm", mimeType: "audio/webm", buffer: Buffer.from("webm") });
  await expect(page.getByText("Transcrevendo áudio…")).toBeVisible();

  const composer = page.getByPlaceholder("Escreva para o Estrategista…");
  await composer.fill("Qual dos três roteiros vendeu mais?");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByRole("button", { name: "Parar resposta" })).toBeHidden();

  transcribed = true;
  // Longer than one status poll (5 s): the late transcription would have landed by now.
  await page.waitForTimeout(7_000);
  await expect(composer).toHaveValue("");
});
