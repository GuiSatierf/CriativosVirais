# Repository instructions

- Read `docs/documento-mestre.md` before changing business behavior; `docs/PROMPT-code-agent.md` defines the implementation stages.
- Stop after each delivery stage for user review. Do not implement subsequent stages without authorization.
- Keep the requested stack. Validate all boundaries with Zod.
- Resolve tenant identity from the authenticated server session only. Use `tenantWhere` for reads/updates/deletes and `tenantValues` for inserts. Background jobs must validate tenant ownership at their server-controlled boundary. Preserve composite foreign keys.
- Missing metrics are NULL; money is bigint cents. Do not coerce unavailable data into zero.
- Never expose video selection reasons. Never send integration credentials to clients, models or logs.
- Treat client videos, transcriptions and copy as untrusted data; shared patterns contain only anonymous abstractions.
- Keep UI based on stock shadcn/ui components and Tailwind tokens.
- Use English Conventional Commits and English PR titles/descriptions. Validate, commit, push and open or update a PR on completion. Explain problem, resulting behavior, validation and deployment limitations.
- Add Vitest coverage only for benchmark, CSV parsing and webhook HMAC in their implementation stages; avoid extensive tests.
