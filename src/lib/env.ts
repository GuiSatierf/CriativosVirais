import { z } from "zod";
import { ConfigError } from "./errors";

const filled = z.string().trim().min(1);
const schemas = {
  db: z.object({ DATABASE_URL: z.url() }),
  auth: z.object({
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
  }),
  storage: z.object({
    S3_ENDPOINT: z.url(),
    S3_PUBLIC_ENDPOINT: z.url().optional().or(z.literal("").transform(() => undefined)),
    S3_REGION: filled,
    S3_ACCESS_KEY: filled,
    S3_SECRET_KEY: filled,
    S3_BUCKET: z.string().min(3),
    S3_FORCE_PATH_STYLE: z.enum(["true", "false"]),
  }),
  ai: z.object({
    DEEPSEEK_API_KEY: filled,
    DEEPSEEK_MODEL_TEXT: filled,
    DEEPSEEK_MODEL_VISION: filled.optional(),
  }),
  aiProvider: z
    .object({
      AI_PROVIDER: z.enum(["deepseek", "fake"]).optional().or(z.literal("").transform(() => undefined)),
      NODE_ENV: z.string().optional(),
    })
    // The fake model exists only for development and automated tests.
    .refine((v) => v.AI_PROVIDER !== "fake" || v.NODE_ENV !== "production"),
  transcribe: z.object({
    GROQ_API_KEY: filled,
    GROQ_WHISPER_MODEL: filled,
  }),
  crypto: z.object({
    ENCRYPTION_KEY: z
      .string()
      .regex(/^[A-Za-z0-9+/]{43}=$/)
      .refine((v) => Buffer.from(v, "base64").length === 32),
  }),
};
type Group = keyof typeof schemas;
const cache = new Map<Group, unknown>();

/** Validates one configuration group on first use; builds never need runtime secrets. */
function group<G extends Group>(name: G): z.infer<(typeof schemas)[G]> {
  if (!cache.has(name)) {
    const result = schemas[name].safeParse(process.env);
    if (!result.success) throw new ConfigError(name);
    cache.set(name, result.data);
  }
  return cache.get(name) as z.infer<(typeof schemas)[G]>;
}
/** Optional providers report absence instead of throwing. */
function optionalGroup<G extends Group>(name: G) {
  const result = schemas[name].safeParse(process.env);
  return result.success ? (result.data as z.infer<(typeof schemas)[G]>) : null;
}

export const dbEnv = () => group("db");
export const authEnv = () => group("auth");
export const storageEnv = () => group("storage");
export const cryptoEnv = () => group("crypto");
export const aiEnv = () => optionalGroup("ai");
export const aiProviderEnv = () => group("aiProvider");
export const transcribeEnv = () => optionalGroup("transcribe");
