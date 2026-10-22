import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { signUp } from "./support";

type RenderCounts = { chat: number; list: number; messages: Record<string, number> };

test("typing skips the message list and streamed replies still update", async ({ page }) => {
  // Observe React's committed work through its development tooling hook. Counting
  // DOM mutations would miss wasted renders that produce identical markup.
  await page.addInitScript(() => {
    type Fiber = {
      type?: { name?: string };
      flags: number;
      memoizedProps?: { message?: { id: string } };
      child: Fiber | null;
      sibling: Fiber | null;
      alternate?: Fiber | null;
    };
    const state = window as typeof window & {
      chatRenderCounts: RenderCounts;
      __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown;
    };
    state.chatRenderCounts = { chat: 0, list: 0, messages: {} };
    const renderers = new Map<number, unknown>();
    state.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers,
      supportsFiber: true,
      inject: (renderer: unknown) => {
        const id = renderers.size + 1;
        renderers.set(id, renderer);
        return id;
      },
      onCommitFiberUnmount: () => {},
      onCommitFiberRoot: (_renderer: number, root: { current: Fiber }) => {
        function visit(fiber: Fiber | null) {
          for (let current = fiber; current; current = current.sibling) {
            // React's PerformedWork flag distinguishes rendering from a memo bailout.
            if (current.flags & 1) {
              // Bundlers may append a numeric suffix to named memo callbacks.
              const name = current.type?.name?.replace(/\d+$/, "");
              const counts = state.chatRenderCounts;
              if (name === "Chat") counts.chat++;
              if (name === "MessageList") counts.list++;
              if (name === "AssistantMessage" || name === "UserMessage") {
                const id = current.memoizedProps?.message?.id;
                if (id) counts.messages[id] = (counts.messages[id] ?? 0) + 1;
              }
            }
            // A bailed-out parent reuses its entire child tree, including old
            // flags. Those descendants did not render in this commit.
            if (current.child !== current.alternate?.child) visit(current.child);
          }
        }
        visit(root.current);
      },
    };
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const history = Array.from({ length: 80 }, (_, index) => ({
    id: randomUUID(),
    role: index % 2 ? "assistant" : "user",
    parts: [{ type: "text", text: index % 2
      ? `## Reply ${index}\n\n- First point\n- **Second point**\n\n> A useful quotation.`
      : `Question ${index}` }],
  }));
  try {
    await signUp(page);
    const conversationId = page.url().split("/").at(-1)!;
    const session = await (await page.request.get("/api/auth/get-session")).json();
    for (const [index, message] of history.entries()) {
      await pool.query(
        `INSERT INTO messages (tenant_id, conversation_id, role, content, created_at)
         SELECT c.tenant_id, c.id, $3, $4::jsonb, now() + $5 * interval '1 millisecond'
         FROM conversations c JOIN tenant_members m ON m.tenant_id = c.tenant_id
         WHERE c.id = $1 AND m.user_id = $2`,
        [conversationId, session.user.id, message.role, JSON.stringify(message), index],
      );
    }
    await page.reload();
    const list = page.getByRole("region", { name: "Mensagens da conversa" });
    await expect(list.getByRole("heading", { name: "Reply 79", exact: true })).toBeVisible();
    const counts = () => page.evaluate(() => (
      window as typeof window & { chatRenderCounts: RenderCounts }
    ).chatRenderCounts);
    // Fail if the hook stops observing real renders after a React upgrade.
    await expect.poll(async () => Object.keys((await counts()).messages).length).toBe(80);
    const before = await counts();
    const composer = page.getByPlaceholder("Escreva para o Estrategista…");
    await composer.pressSequentially("A new question about the next creative. ".repeat(2));
    await expect(composer).toHaveValue("A new question about the next creative. ".repeat(2));
    const after = await counts();
    expect(after.chat).toBeGreaterThan(before.chat);
    expect(after.list).toBe(before.list);
    expect(after.messages).toEqual(before.messages);

    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(list.getByText(/Recebi a sua mensagem/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Parar resposta" })).toBeHidden();
    await expect(list.getByText(/Conte o que você vende/)).toBeVisible();
    const streamed = await counts();
    const newIds = Object.keys(streamed.messages).filter((id) => !after.messages[id]);
    expect(newIds).toHaveLength(2);
    // The assistant commits multiple chunks; memo must not freeze the reply.
    expect(Math.max(...newIds.map((id) => streamed.messages[id]))).toBeGreaterThan(1);
    // The previously last assistant may render once to hide its always-visible
    // copy button. Earlier messages must skip every streaming chunk.
    for (const message of history.slice(0, -1)) {
      expect(streamed.messages[message.id]).toBe(after.messages[message.id]);
    }
  } finally {
    await pool.end();
  }
});
