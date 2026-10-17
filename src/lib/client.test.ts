import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { api } from "./client";

const schema = z.object({ saved: z.boolean() });

afterEach(() => vi.unstubAllGlobals());

describe("api() errors shown to the user", () => {
  it("turns a network failure into a pt-BR message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api("/api/x", schema)).rejects.toThrow("Sem conexão com o servidor. Confira a internet e tente de novo.");
  });

  it("does not show validation JSON when the response has an unexpected shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ saved: "sim" }), { status: 200 })));
    await expect(api("/api/x", schema)).rejects.toThrow("Não foi possível concluir. Tente novamente.");
  });

  it("keeps the server's pt-BR error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Conecte a UTMify primeiro." }), { status: 404 })));
    await expect(api("/api/x", schema)).rejects.toThrow("Conecte a UTMify primeiro.");
  });
});
