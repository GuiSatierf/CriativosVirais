import { expect, test } from "@playwright/test";

test("pages send a nonce CSP that blocks framing and remote images", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  const response = await page.goto("/login");
  const headers = response!.headers();
  const policy = headers["content-security-policy"] ?? "";
  expect(policy).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce, "nonce in the policy").toBeTruthy();

  // Next.js tags the scripts it renders with the request's nonce; scripts they load later are
  // trusted through 'strict-dynamic'. The page works and nothing is refused.
  const scriptTags = (await response!.text()).match(/<script\b[^>]*>/g) ?? [];
  expect(scriptTags.length).toBeGreaterThan(0);
  expect(scriptTags.filter((tag) => !tag.includes(`nonce="${nonce}"`))).toEqual([]);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  expect(violations).toEqual([]);

  // Text rendered from the model cannot make the browser fetch a remote address.
  const blocked = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener("securitypolicyviolation", (event) => resolve(event.violatedDirective), {
          once: true,
        });
        const image = document.createElement("img");
        image.src = "https://example.com/pixel.png";
        document.body.append(image);
      }),
  );
  expect(blocked).toBe("img-src");
});
