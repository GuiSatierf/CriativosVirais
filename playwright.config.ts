import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests sign up real accounts and write data, so they only run against a
// database whose name ends in _test, with the scripted fake model (never a paid provider).
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
  throw new Error("E2E tests need DATABASE_URL pointing to a database whose name ends in _test.");
process.env.AI_PROVIDER = "fake";
// A fixed Hotmart hottok and product, so the purchase webhook can be exercised without Hotmart.
process.env.HOTMART_HOTTOK = "e2e-hottok";
process.env.HOTMART_PRODUCT_IDS = "1234567";
// Reset emails land in a local folder that the specs read; nothing is sent.
process.env.EMAIL_OUTBOX_DIR = "test-results/outbox";

const port = 3100;
const baseURL = `http://localhost:${port}`;
process.env.BETTER_AUTH_URL = baseURL;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // The dev server compiles each route on first visit.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The fake model is refused in production builds, so the suite runs on the dev server.
    command: `npx next dev -p ${port}`,
    url: `${baseURL}/login`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
  },
});
