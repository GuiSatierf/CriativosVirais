import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

async function main() {
  const { values } = parseArgs({
    options: { file: { type: "string", default: ".env" } },
  });
  const template = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const password = randomBytes(24).toString("hex");
  const replacements = {
    POSTGRES_PASSWORD: password,
    DATABASE_URL: `postgresql://creatives:${password}@localhost:55432/creatives`,
    BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
    ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    S3_ACCESS_KEY: randomBytes(16).toString("hex"),
    S3_SECRET_KEY: randomBytes(32).toString("hex"),
  };
  const content = template.split("\n").map((line) => {
    const key = line.split("=", 1)[0];
    return Object.hasOwn(replacements, key) ? `${key}=${replacements[key]}` : line;
  }).join("\n");
  try {
    await writeFile(resolve(values.file), content, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code === "EEXIST") {
      console.info("Arquivo existente preservado. Execute npm run doctor para revisar a configuração.");
      return;
    }
    throw error;
  }
  console.info("Ambiente local criado com segredos aleatórios e permissão 600. Configure os provedores quando estiver pronto; nenhum segredo foi exibido.");
}
main().catch(() => {
  console.error("Não foi possível criar o ambiente. Verifique o destino e as permissões.");
  process.exitCode = 1;
});
