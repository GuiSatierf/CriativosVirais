import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// A take from a microphone that heard nothing came back from transcription as invented words
// ("E aí", "."). A silent recording must warn and never be uploaded for transcription.
function silentWav(seconds: number) {
  const rate = 48_000;
  const samples = rate * seconds;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  return wav;
}

const silence = join(mkdtempSync(join(tmpdir(), "e2e-voice-")), "silence.wav");
writeFileSync(silence, silentWav(5));

test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${silence}`],
  },
  permissions: ["microphone"],
});

test("a silent recording warns and is not sent for transcription", async ({ page }) => {
  let uploads = 0;
  await page.route("**/api/uploads/presign", (route) => {
    uploads += 1;
    return route.abort();
  });
  await signUp(page);

  await page.getByRole("button", { name: "Gravar áudio" }).click();
  await expect(page.getByRole("button", { name: "Parar" })).toBeVisible();
  await page.waitForTimeout(1_500);
  await page.getByRole("button", { name: "Parar" }).click();

  await expect(page.getByText("Não ouvimos nada. Confira o microfone.")).toBeVisible();
  expect(uploads).toBe(0);
});
