# Criativos Virais

V1 de uma ferramenta de roteiros para anúncios em vídeo. A fonte de verdade de negócio é [`docs/documento-mestre.md`](docs/documento-mestre.md); o plano de implementação está em [`docs/PROMPT-code-agent.md`](docs/PROMPT-code-agent.md).

## Entrega atual: etapa 1

- Next.js App Router, TypeScript estrito, Tailwind e componentes oficiais shadcn/ui.
- Login/cadastro com email e senha via Better Auth, logout e páginas protegidas.
- Tenant e contexto inicial criados automaticamente; uma operação por usuário nesta V1.
- Schema Drizzle completo e migration SQL versionada: dinheiro em `bigint` centavos, métricas ausentes em `NULL`, índices por tenant, idempotência de eventos e vínculos compostos para impedir associações entre operações.
- Layout responsivo com conversa, criativos, levas, integrações e configurações. Funcionalidades futuras aparecem identificadas pela etapa, sem dados fictícios.
- Imagem standalone compartilhada entre app e worker, ffmpeg, Postgres e RustFS. A fila usa o próprio Postgres, sem Redis.

O chat e a geração de levas começam na etapa 2. Áudio e vídeo, CSV/benchmark, webhooks/conectores e aprendizado seguem nas etapas 3–6. A etapa 1 não faz chamadas de IA nem processa vídeos. O worker inicia o pg-boss e aguarda; nenhum job de processamento está registrado ainda.

## Desenvolvimento local

Requisitos: Node.js 22+, npm, Docker e Docker Compose. O lockfile é a referência para as versões.

```sh
npm ci
cp .env.example .env
```

Preencha `.env` antes de iniciar os serviços:

- `BETTER_AUTH_SECRET`: segredo aleatório de pelo menos 32 caracteres.
- `S3_ACCESS_KEY` / `S3_SECRET_KEY`: credenciais únicas do RustFS.
- `POSTGRES_PASSWORD`: senha única; use o mesmo valor em `DATABASE_URL`. Use uma senha hexadecimal ou faça URL-encoding dos caracteres especiais na URL.
- `ENCRYPTION_KEY`: 32 bytes em base64, reservada para criptografia das integrações.

Exemplos de geração, executados localmente:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

As chaves DeepSeek/Groq e os IDs de modelos podem permanecer vazios nesta etapa. Não existem IDs de modelos hardcoded. Antes da etapa 3 será necessário confirmar suporte real a imagens no modelo/provedor DeepSeek; um nome de variável não garante capacidade multimodal.

```sh
docker compose up -d --wait postgres rustfs
npm run db:migrate
npm run storage:init
npm run dev
```

Abra `http://localhost:3000/signup`. O cadastro cria uma conta e sua operação; entre novamente pelo login para revisar o fluxo. As páginas internas redirecionam usuários sem sessão para `/login`.

Portas locais: app `3000`, Postgres `55432`, RustFS S3 `9000` e console `9001`. Todas as portas do Compose são limitadas a loopback. `POSTGRES_PORT` permite ajustar a porta do Postgres; atualize também `DATABASE_URL` para comandos no host. O Compose substitui a URL do banco e o endpoint S3 pelos endereços internos quando executa app/worker nos containers.

O bucket é privado e criado pelo comando `storage:init`. Não habilite acesso público. Upload direto e CORS por origem serão configurados na etapa 3; a URL S3 assinada deverá apontar para um endpoint alcançável pelo navegador.

## Execução completa com Docker

```sh
docker compose build app
docker compose up -d --wait postgres rustfs
docker compose run --rm --no-deps app node dist/tools/src/db/migrate.js
docker compose run --rm --no-deps app node dist/tools/scripts/init-storage.js
docker compose --profile full up -d app worker
```

App e worker usam a mesma imagem. App: `node server.js`; worker: `node dist/worker.js`. A imagem contém migrations e documento mestre e roda como usuário sem privilégios. Os comandos de migração e criação de bucket são tarefas pontuais usando a mesma imagem, não serviços adicionais permanentes.

```sh
docker compose logs -f app worker
docker compose stop
```

Os volumes persistem ao parar/recriar os serviços. Remover volumes apaga os dados; faça backup antes de operações desse tipo.

## Deploy no Coolify

Prepare três serviços de infraestrutura/aplicação (`app`, `postgres`, `rustfs`) e uma segunda execução da imagem da aplicação para o `worker`:

1. Conecte o repositório privado ao Coolify e selecione a branch aprovada. Configure build via `Dockerfile`, porta interna `3000` e healthcheck `/api/health`.
2. Crie Postgres 17 com volume persistente. `DATABASE_URL` deve usar o hostname interno da rede e credenciais próprias. Não publique a porta do banco.
3. Crie RustFS com a imagem fixada por digest no Compose, volumes `/data` e `/logs` e credenciais únicas. Publique somente o endpoint S3 por HTTPS quando uploads diretos forem implementados. Restrinja o console administrativo.
4. Configure as variáveis de runtime no app e worker. `BETTER_AUTH_URL` deve ser a URL HTTPS exata do app, usada também como origem confiável. Segredos não são necessários no build e não devem ser build args.
5. Execute `node dist/tools/src/db/migrate.js` uma vez na nova imagem, com o banco disponível, antes de liberar tráfego. Execute `node dist/tools/scripts/init-storage.js` com o RustFS disponível. Não rode migrations concorrentes no startup de cada réplica.
6. Configure o worker para a mesma imagem/revisão, comando `node dist/worker.js`, sem domínio nem porta pública, na mesma rede do Postgres/RustFS.
7. Valide cadastro, login, logout, proteção das páginas e persistência após reiniciar app/worker. Faça backup dos volumes de banco/storage antes de futuras migrations.

Não há deploy automático neste repositório. A criação do PR não publica a aplicação nem aplica migrations em produção.

## Isolamento e segurança

`requireTenant()` obtém a identidade da sessão no servidor. `tenantWhere()` compõe o filtro obrigatório para leituras/alterações/exclusões; `tenantValues()` sobrescreve qualquer tenant fornecido com a identidade autenticada. O provisionamento é transacional, com lock por usuário, e recupera um cadastro interrompido sem duplicar a operação. Vínculos compostos `(tenant_id, id)` impedem referências entre tenants no Postgres.

As tabelas de identidade do Better Auth e o limitador de autenticação são globais. As tabelas de conteúdo do cliente têm `tenant_id` obrigatório; `shared_patterns` é a exceção explícita para abstrações anônimas. Não há escrita em padrões compartilhados nesta etapa. O banco não usa RLS: queries futuras devem passar pelos helpers, e jobs devem validar a propriedade na fronteira do worker.

Email/senha usa o hash e as sessões gerenciados pelo Better Auth. O limitador de autenticação persiste em Postgres. Não existe recuperação de senha ou verificação por email nesta entrega; essas funções exigem um serviço de email e escopo adicional. Não há credenciais em páginas, respostas de erro, URLs ou logs da aplicação.

## Verificação

```sh
npm run lint
npm run typecheck
npm run build
npm run db:generate
npm audit --omit=dev
```

`db:generate` deve indicar ausência de mudanças após uma migration coerente. A CI valida lint, TypeScript e build sem banco ou segredos. Nesta etapa os fluxos de autenticação, schema, RustFS e worker são verificados por smoke checks locais; os testes Vitest solicitados serão adicionados somente com benchmark, CSV e HMAC nas etapas correspondentes.

A auditoria de dependências de produção não apresenta vulnerabilidades conhecidas. A árvore de ferramentas de desenvolvimento ainda reporta o advisory de `braces` (GHSA-vfj7-8cjw-p6xm), sem versão corrigida disponível no registry consultado; ela é usada por ESLint/shadcn e não entra nas dependências de produção da imagem. Não foi aplicado o downgrade incompatível sugerido por `npm audit fix --force`. O override do esbuild transitivo remove o advisory da versão antiga trazida pelo loader do drizzle-kit; a geração/migração foi validada com esse override.

Referências de implementação: [Better Auth / Drizzle](https://better-auth.com/docs/adapters/drizzle), [Better Auth / database hooks](https://better-auth.com/docs/concepts/database), [Next.js standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [RustFS containers](https://docs.rustfs.com/en/installation/container/).
