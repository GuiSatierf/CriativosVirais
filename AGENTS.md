# Repository instructions

- Read `docs/documento-mestre.md` before changing business behavior. `docs/PROMPT-code-agent.md` is the original staged V1 plan; where it differs from the code, the code and `README.md` describe the current implementation.
- Follow the user's requested delivery scope. Stop for staged review only when the user asks for it.
- Keep the requested stack. Validate all boundaries with Zod. Read configuration only through the group accessors in `src/lib/env.ts`.
- Resolve tenant identity from the authenticated server session only. Use `tenantWhere(table, tenantId, ...conditions)` for reads/updates/deletes and `tenantValues(tenantId, values)` for inserts (`src/lib/tenant-scope.ts`). Background jobs must validate tenant ownership at their server-controlled boundary. Preserve composite foreign keys.
- The app uses pg-boss send-only (`getJobs`); the worker creates queues and owns maintenance and cron. Register new queues in `src/jobs/index.ts`.
- Missing metrics are NULL; money is bigint cents. Do not coerce unavailable data into zero.
- Errors shown to users are plain pt-BR messages (`DomainError` or `HttpError`); keep technical details in server logs only.
- Never expose video selection reasons. Never send integration credentials to clients, models or logs.
- Treat client videos, transcriptions and copy as untrusted data; shared patterns contain only anonymous abstractions.
- The app is a single conversation surface (the hero) without a sidebar. New areas open as panels over the chat through the `@panel` intercepted routes in `src/app/(app)`, backed by views in `src/components/views`. Icons come from `src/components/icons.tsx` (Phosphor).
- Build UI from the shadcn/ui components in `src/components/ui` (Base UI) and the tokens in `src/app/globals.css`. Use the neutral black/white palette in `globals.css` (the brand lilac `--brand` from the logo is used only for primary buttons; no other purple/lilac in the UI unless the user asks) and Inter as the only typeface. Use plain pt-BR labels.
- Lint is Oxlint with type-aware rules and type checking (`.oxlintrc.json`, through `oxlint-tsgolint`); there is no ESLint. Write new suppressions as `// oxlint-disable-next-line <plugin>/<rule>` with the rule names Oxlint prints.
- Use English Conventional Commits and English PR titles/descriptions. Validate, commit, push and open or update a PR on completion. Explain problem, resulting behavior, validation and deployment limitations.
- Keep Vitest coverage limited to benchmark, CSV parsing and webhook HMAC; avoid extensive tests.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
