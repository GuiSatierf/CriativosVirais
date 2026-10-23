import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./support";

/** The computed value of a colour token, read the same way the browser paints it. */
function tokenColor(page: Page, token: string, property: "backgroundColor" | "borderTopColor") {
  return page.evaluate(
    ([name, key]) => {
      const probe = document.createElement("div");
      probe.style.setProperty(key === "backgroundColor" ? "background-color" : "border-top-color", `var(${name})`);
      probe.style.borderTopStyle = "solid";
      document.body.append(probe);
      const value = getComputedStyle(probe)[key];
      probe.remove();
      return value;
    },
    [token, property] as const,
  );
}

test("dark mode keeps disabled fields and outline buttons on the light-mode tokens", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await signUp(page);
  await page.goto("/perfil");

  const name = page.getByLabel("Nome");
  await name.evaluate((field) => field.setAttribute("disabled", ""));
  const disabledBackground = await name.evaluate((field) => getComputedStyle(field).backgroundColor);
  expect(disabledBackground).toBe(await tokenColor(page, "--muted", "backgroundColor"));

  const photo = page.getByRole("button", { name: "Enviar foto" });
  const outlineBorder = await photo.evaluate((button) => getComputedStyle(button).borderTopColor);
  expect(outlineBorder).toBe(await tokenColor(page, "--border", "borderTopColor"));
});
