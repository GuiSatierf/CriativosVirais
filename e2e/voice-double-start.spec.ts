import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// Two clicks on the microphone opened two recordings that shared one clock: the timer flipped
// between counts and the older one kept recording after Parar. Only one recording may run.
test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  permissions: ["microphone"],
});

test("a second click on the microphone does not start a second recording", async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.MediaRecorder;
    const created: MediaRecorder[] = [];
    Object.assign(window, { e2eRecorders: created });
    window.MediaRecorder = class extends Original {
      constructor(...args: ConstructorParameters<typeof MediaRecorder>) {
        super(...args);
        created.push(this);
      }
    } as typeof MediaRecorder;
  });
  await signUp(page);

  await page.getByRole("button", { name: "Gravar áudio" }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole("button", { name: "Parar" })).toBeVisible();
  await page.waitForTimeout(1_500);
  await page.getByRole("button", { name: "Parar" }).click();

  const recorders = () =>
    page.evaluate(() => {
      const list = (window as unknown as { e2eRecorders: MediaRecorder[] }).e2eRecorders;
      return { created: list.length, recording: list.filter((recorder) => recorder.state === "recording").length };
    });
  await expect.poll(recorders).toEqual({ created: 1, recording: 0 });
});
