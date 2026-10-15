import { config } from "dotenv";
import { parseArgs, promisify } from "node:util";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Pool } from "pg";
import { HeadBucketCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { getStorage } from "../src/lib/storage";

const exec = promisify(execFile);
async function main() {
  const { values } = parseArgs({ options: {
    connections: { type: "boolean", default: false },
    production: { type: "boolean", default: false },
    "strict-providers": { type: "boolean", default: false },
    file: { type: "string", default: ".env" },
  }});
  config({ path: values.file, quiet: true });
  let failures = 0;
  function report(name: string, ok: boolean, detail: string, required = true) {
    if (!ok && required) failures++;
    console.info(`[${ok ? "OK" : required ? "FAIL" : "WARN"}] ${name}: ${detail}`);
  }
  const present = z.string().trim().min(1).refine((s) =>
    !/(^(change[-_]|replace|your[-_]|<)|URL_ENCODED_PASSWORD|(?:APP|S3_PUBLIC)_DOMAIN|(?:POSTGRES|RUSTFS)_INTERNAL_HOST)/i.test(s));
  const httpUrl = z.url().pipe(present).refine((s) => URL.canParse(s) && ["http:", "https:"].includes(new URL(s).protocol));
  const database = z.url().pipe(present).refine((s) => URL.canParse(s) && ["postgres:", "postgresql:"].includes(new URL(s).protocol));
  const checks: Record<string, z.ZodType> = {
    DATABASE_URL: database,
    BETTER_AUTH_SECRET: present.pipe(z.string().min(32)),
    BETTER_AUTH_URL: httpUrl,
    ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/]{43}=$/).refine((s) => Buffer.from(s, "base64").length === 32),
    S3_ENDPOINT: httpUrl,
    S3_PUBLIC_ENDPOINT: httpUrl,
    S3_REGION: present,
    S3_ACCESS_KEY: present,
    S3_SECRET_KEY: present,
    S3_BUCKET: z.string().min(3),
    S3_FORCE_PATH_STYLE: z.enum(["true", "false"]),
  };
  const valid = new Map<string, boolean>();
  for (const [name, schema] of Object.entries(checks)) {
    const effective = name === "S3_PUBLIC_ENDPOINT" ? process.env[name] || process.env.S3_ENDPOINT : process.env[name];
    const ok = schema.safeParse(effective).success;
    valid.set(name, ok);
    report(name, ok, ok ? name === "S3_PUBLIC_ENDPOINT" && !process.env[name] ? "usa S3_ENDPOINT; confira o acesso pelo navegador" : "configurado (valor oculto)" : "ausente, placeholder ou formato inválido");
  }
  if (valid.get("DATABASE_URL")) {
    const url = new URL(process.env.DATABASE_URL!);
    report("Senha do banco", !url.password || present.safeParse(decodeURIComponent(url.password)).success,
      "credencial na URL verificada sem exibir valores");
  }
  if (values.production) {
    for (const name of ["BETTER_AUTH_URL", "S3_PUBLIC_ENDPOINT"]) {
      const ok = valid.get(name) && new URL(process.env[name] || process.env.S3_ENDPOINT!).protocol === "https:";
      report(`HTTPS ${name}`, Boolean(ok), ok ? "HTTPS configurado" : "produção exige URL pública HTTPS");
    }
  }
  for (const [name, required] of [
    ["DEEPSEEK_API_KEY", "chat e geração"],
    ["DEEPSEEK_MODEL_TEXT", "chat e geração"],
    ["DEEPSEEK_MODEL_VISION", "análise visual"],
    ["GROQ_API_KEY", "transcrição"],
    ["GROQ_WHISPER_MODEL", "transcrição"],
  ]) {
    const ok = present.safeParse(process.env[name]).success;
    report(name, ok, ok ? "configurado; chamada real não executada" : `pendente para ${required}`,
      values["strict-providers"]);
  }
  for (const binary of ["ffmpeg", "ffprobe"]) {
    try {
      await exec(binary, ["-version"], { timeout: 5000, maxBuffer: 100_000 });
      report(binary, true, "executável disponível neste ambiente");
    } catch {
      report(binary, false, "indisponível aqui; verifique no container do worker", values.production);
    }
  }
  let migrationHashes: string[] | undefined;
  try {
    const journal = z.object({ entries: z.array(z.object({ idx: z.number(), tag: z.string().regex(/^[a-zA-Z0-9_-]+$/) })) })
      .parse(JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")));
    migrationHashes = await Promise.all(journal.entries.map(async (entry) =>
      createHash("sha256").update(await readFile(`drizzle/${entry.tag}.sql`, "utf8")).digest("hex")));
    await readFile("docs/documento-mestre.md", "utf8");
    report("Arquivos de runtime", true, "documento mestre e migrations disponíveis");
  } catch {
    report("Arquivos de runtime", false, "execute a partir da raiz do projeto ou de /app no container");
  }
  if (values.connections) {
    if (valid.get("DATABASE_URL")) {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
        connectionTimeoutMillis: 5000, query_timeout: 5000 });
      try {
        await pool.query("SELECT 1");
        report("Postgres", true, "conexão de leitura confirmada");
        const result = await pool.query("SELECT hash FROM drizzle.__drizzle_migrations");
        const migrated = migrationHashes !== undefined && migrationHashes.every((hash) => result.rows.some((row) => row.hash === hash));
        report("Migrations", migrated, migrated ? "migrations do build aplicadas" : "execute db:migrate antes de ativar");
      } catch {
        report("Postgres/migrations", false, "verifique conexão, permissões e aplicação das migrations");
      } finally { await pool.end(); }
    }
    if (Object.keys(checks).filter((name) => name.startsWith("S3_")).every((name) => valid.get(name))) {
      const { client, bucket } = getStorage();
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }), { abortSignal: AbortSignal.timeout(8000) });
        report("Bucket S3", true, "bucket existente e acessível (sem escrever objetos)");
        const cors = await client.send(new GetBucketCorsCommand({ Bucket: bucket }), { abortSignal: AbortSignal.timeout(8000) });
        const origin = valid.get("BETTER_AUTH_URL") ? new URL(process.env.BETTER_AUTH_URL!).origin : undefined;
        const allowed = Boolean(origin && cors.CORSRules?.some((rule) =>
          rule.AllowedOrigins?.includes(origin) && rule.AllowedMethods?.includes("PUT") &&
          rule.AllowedHeaders?.some((header) => ["content-type", "*"].includes(header.toLowerCase()))));
        report("CORS de upload", allowed, allowed ? "origem do app e PUT autorizados" : "execute storage:init com a origem final do app");
      } catch {
        report("S3/CORS", false, "verifique endpoint, credenciais, bucket e configuração CORS");
      } finally { client.destroy(); }
    }
  } else {
    console.info("[INFO] Nenhuma conexão externa executada. Use --connections para consultar Postgres e S3.");
  }
  console.info("[INFO] UTMify e webhook são conectados pela tela Integrações.");
  console.info("[INFO] O endpoint público S3, o worker ativo e os provedores precisam de validação final no ambiente de destino.");
  console.info(failures ? `Diagnóstico: ${failures} requisito(s) pendente(s).` : "Diagnóstico: requisitos verificados; revise os avisos e conexões não executadas.");
  process.exitCode = failures ? 1 : 0;
}
main().catch(() => {
  console.error("Diagnóstico interrompido. Verifique os argumentos e execute a partir da raiz do projeto.");
  process.exitCode = 1;
});
