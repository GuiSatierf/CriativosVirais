import { z } from "zod";
import { getAuth } from "./auth";
import { authEnv } from "./env";
import { provisionTenant } from "./provision-tenant";
import { DomainError, HttpError } from "./errors";
import { bigintReplacer } from "./json";
import { logError } from "./log";
export { HttpError } from "./errors";
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value, bigintReplacer), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
/** Reads the raw body, stopping as soon as it exceeds `max` bytes. */
export async function readBody(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Envie o conteúdo da requisição.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "Arquivo ou mensagem muito grande.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  max = 1_000_000,
): Promise<T> {
  const body = (await readBody(request, max)).toString("utf8");
  try {
    return schema.parse(JSON.parse(body));
  } catch {
    throw new HttpError(400, "Dados inválidos. Confira os campos e formatos.");
  }
}
export async function apiTenant(request: Request) {
  const { BETTER_AUTH_URL } = authEnv();
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !== new URL(BETTER_AUTH_URL).origin
  )
    throw new HttpError(403, "Origem não autorizada.");
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "Entre na sua conta.");
  return { tenantId: await provisionTenant(session.user), user: session.user };
}
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof DomainError) {
      if (error.code === "unavailable") logError("api", error);
      return json({ error: error.message }, error.status);
    }
    if (error instanceof z.ZodError)
      return json({ error: "Dados inválidos." }, 400);
    logError("api", error);
    return json(
      { error: "Não foi possível concluir agora. Tente novamente em instantes." },
      503,
    );
  }
}
