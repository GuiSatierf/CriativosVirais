import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// A video whose analysis failed must not keep the composer locked: the person can
// still send a message without discovering that the attachment has to be removed.
// Storage and analysis are simulated so the test needs neither the bucket nor ffmpeg. The
// simulated upload URL sits on the app's own origin, which the CSP connect-src allows.
test("a failed video analysis does not block sending messages", async ({ page }) => {
  const assetId = randomUUID();
  await page.route("**/api/uploads/presign", (route) =>
    route.fulfill({ json: { url: new URL("/e2e-simulated-upload", route.request().url()).href, assetId } }),
  );
  await page.route("**/e2e-simulated-upload", (route) => route.fulfill({ status: 200 }));
  await page.route("**/api/uploads/complete", (route) =>
    route.fulfill({ status: 202, json: { assetId, status: "uploaded" } }),
  );
  await page.route(`**/api/assets/${assetId}`, (route) =>
    route.fulfill({
      json: { id: assetId, status: "error", kind: "video", error: "Não foi possível analisar o vídeo.", transcription: null },
    }),
  );

  await signUp(page);
  await page.getByRole("button", { name: "Anexar vídeo ou áudio" }).click();
  await page
    .locator("#chat-attachments input[type=file]")
    .first()
    .setInputFiles({ name: "anuncio.webm", mimeType: "video/webm", buffer: Buffer.from("webm") });
  await expect(page.getByText("Não foi possível analisar o vídeo.")).toBeVisible();
  // The prompt filled in for the upload would be sent without the video.
  await expect(page.getByPlaceholder("Escreva para o Estrategista…")).toHaveValue("");

  await page.getByPlaceholder("Escreva para o Estrategista…").fill("Quero te contar sobre a minha oferta.");
  await expect(page.getByRole("button", { name: "Enviar mensagem" })).toBeEnabled();
});
