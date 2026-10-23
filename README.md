# Criativos Virais

Ferramenta em que a IA atua como copywriter de anúncios em vídeo para uma operação de infoproduto. A conversa coleta o contexto do negócio, cruza métricas por criativo, pede os vídeos que valem análise e gera levas de roteiros prontos para gravar, com códigos `Lxx-Cxx` para usar como `utm_content`. Os resultados desses códigos voltam por CSV ou webhook e alimentam a memória da operação.

A fonte de verdade de negócio é [`docs/documento-mestre.md`](docs/documento-mestre.md). O plano original de implementação por etapas está em [`docs/PROMPT-code-agent.md`](docs/PROMPT-code-agent.md); onde ele diverge do código, vale o código e este README.

## Funcionalidades

- Cadastro por email e senha (Better Auth). Cada usuário recebe uma operação (tenant) e um contexto vazio. Não há redefinição de senha por email: `/recuperar-senha` orienta o contato com o suporte.
- Uma tela só: a conversa com o Estrategista (`/chat`). Antes da primeira mensagem ela mostra novidades (vídeos em análise, integrações com erro, leva com resultados) e as próximas ações sugeridas pelo servidor, sem chamar o modelo. Não há barra lateral: o topo tem nova conversa, histórico (Ctrl/⌘ + K, com renomear, arquivar e excluir) e o menu da conta. Tema claro e escuro.
- Levas (`/levas`), Resultados (`/criativos`), Minha oferta (`/configuracoes`), Integrações e Perfil abrem como painéis sobre a conversa (rotas interceptadas no slot `@panel`); acessados direto pelo endereço, abrem como página inteira. O assistente mostra atalhos para esses painéis na conversa.
- Arrastar um vídeo, áudio ou CSV para a conversa envia o arquivo; o CSV abre a importação já preenchida.
- Conversas vazias não aparecem no histórico e são reaproveitadas ao criar uma nova. Levas podem ser renomeadas e arquivadas, nunca excluídas; criativos podem ser ocultados da lista e ter o vídeo excluído; a conta pode trocar a senha e ser excluída com todos os dados.
- Chat em streaming (Vercel AI SDK + DeepSeek) com histórico por conversa. O servidor monta o histórico a partir do banco e ignora mensagens de assistente enviadas pelo navegador.
- Áudio gravado no chat é transcrito (Groq) e o texto entra no campo de mensagem para revisão; nada é enviado automaticamente. Vídeos enviados podem ser anexados à mensagem.
- Geração de levas com saída estruturada (Zod), revisão de qualidade por item e regeneração apenas dos itens reprovados. Título no formato `Leva 03 · Produto · 14/10/2026`. Exportação em `.docx`.
- Análise de vídeo no worker: transcrição, até 40 frames, descrição visual e análise com blocos, timestamps e incertezas.
- Contexto do negócio coletado na conversa (o assistente salva cada resposta e mostra o cartão "Anotei na sua oferta") e editável no painel Minha oferta; o preço é informado em reais e salvo em centavos.
- Métricas por CSV (mapeamento de colunas), webhook de vendas assinado e resumo UTMify. Ranking interno top 5 das 14 métricas por janela, fonte e campanha, com glossário das métricas na tela Criativos.
- Resultados por leva, aprendizados privados com nível de evidência e padrões compartilhados anônimos.
- Painel da equipe (`/admin`), com verificação em duas etapas obrigatória e registro de cada ação. Papéis: dono (tudo, inclusive a aba Equipe), admin (libera e bloqueia e-mails e contas, entra na conta de clientes) e suporte (só a aba Contas). "Entrar como cliente" abre a conta por até 1 hora, sem senha e com motivo obrigatório; uma faixa no topo mostra a visita. Pela mesma aba a equipe troca o e-mail e define uma senha nova para o cliente; excluir a conta, duas etapas e sessões ficam só com o cliente. O primeiro dono é criado no servidor com `node dist/tools/scripts/admin-access.js make-owner <email>`.

Fora do escopo: edição ou renderização de vídeo, publicação de anúncios e alteração de campanhas.

## Arquitetura

| Processo | Responsabilidade |
| --- | --- |
| App (Next.js 16, standalone) | Páginas, APIs, chat em streaming, envio de jobs |
| Worker (`dist/worker.js`) | Filas `analyze-video`, `ingest-event` e `sync-metrics`; sincronização UTMify a cada seis horas, com um job por integração |
| PostgreSQL 17 | Dados, sessões, rate limit de autenticação e filas pg-boss |
| RustFS (S3) | Áudios e vídeos em bucket privado, enviados pelo navegador com URL assinada |

O app usa pg-boss só para enviar jobs. O worker instala o schema do pg-boss, cria as filas e roda manutenção e cron; por isso precisa iniciar ao menos uma vez antes de o app enfileirar trabalho. App e worker usam a mesma imagem e precisam estar na mesma versão do schema.

| Diretório | Conteúdo |
| --- | --- |
| `src/app` | Páginas (`(app)`, `(auth)`) e rotas HTTP em `api/` |
| `src/lib` | Domínio: métricas, conectores (`connectors/`), levas, IA (`ai/`), criptografia, storage, `env.ts`, `tenant-scope.ts` |
| `src/jobs`, `src/worker.ts` | Handlers das filas, cliente pg-boss e entrypoint do worker |
| `src/db`, `drizzle/` | Schema Drizzle e migrations (`0000`–`0003`) |
| `src/components` | Componentes da interface; `ui/` contém os componentes shadcn/ui (Base UI) |
| `scripts` | Setup de ambiente, diagnóstico, bucket, start standalone e teste de atribuição |

A configuração é validada por grupo em `src/lib/env.ts` no primeiro uso, então o build não precisa de banco nem de segredos. Erros de domínio (`DomainError`) carregam mensagens em português seguras para o usuário; detalhes técnicos ficam só no log do servidor.

## Requisitos

Node.js 22+, npm, Docker e Docker Compose. ffmpeg e ffprobe são necessários onde o worker roda (já incluídos na imagem Docker).

## Configuração local

```sh
npm ci
npm run setup:env
docker compose up -d --wait postgres rustfs
npm run db:migrate
npm run storage:init
npm run build:worker
npm run worker   # em outro terminal; inicie antes de usar upload, webhook ou sync
npm run dev
```

Abra `http://localhost:3000/signup`. `setup:env` cria `.env` com segredos aleatórios e não sobrescreve um arquivo existente. As portas do Compose ficam em loopback: Postgres `55432` (`POSTGRES_PORT`), RustFS `9000` e console `9001`.

Para rodar app e worker também em containers (perfil `full`), atualizar instalações existentes e publicar no Coolify, siga o [guia de ativação e deploy](docs/ativacao.md).

### Variáveis de ambiente

Referências: [`.env.example`](.env.example) (local) e [`.env.production.example`](.env.production.example) (runtime de produção).

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão Postgres. Use senha hexadecimal ou URL-encoding |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Só para o Postgres do Compose |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Segredo de 32+ caracteres e URL exata do app, usada como origem confiável |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE` | Storage acessado pelo servidor |
| `S3_PUBLIC_ENDPOINT` | Opcional. Endpoint que o navegador alcança para enviar arquivos; padrão é `S3_ENDPOINT` |
| `ENCRYPTION_KEY` | 32 bytes em base64 para AES-256-GCM das credenciais de integração. Trocar a chave torna as credenciais salvas ilegíveis |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL_TEXT` | Chat, geração e revisão de levas, análise estruturada |
| `DEEPSEEK_MODEL_VISION` | Descrição dos frames; precisa aceitar imagens |
| `AI_PROVIDER` | Opcional. `fake` troca o modelo de texto por um roteiro fixo (`src/lib/ai/fake-model.ts`), sem chamar a DeepSeek; só em desenvolvimento e testes, recusado com `NODE_ENV=production` |
| `GROQ_API_KEY`, `GROQ_WHISPER_MODEL` | Transcrição de áudio e da trilha dos vídeos |
| `AI_MONTHLY_LIMIT_CENTS` | Opcional. Teto de gasto com IA por operação no mês (horário de São Paulo), em centavos; padrão `2000` (R$ 20). Ao chegar nele, chat, levas e análise de vídeo param até o mês virar |
| `AI_PRICE_INPUT_CENTS_PER_MTOK`, `AI_PRICE_CACHED_INPUT_CENTS_PER_MTOK`, `AI_PRICE_OUTPUT_CENTS_PER_MTOK` | Opcionais. Preço do provedor em centavos de real por milhão de tokens (entrada, entrada em cache, saída), usado para medir o gasto; padrões `170`, `20` e `680` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Recuperação de senha por e-mail (Resend). `EMAIL_FROM` usa um domínio verificado no Resend, por exemplo `Criativos Virais <nao-responda@mail.exemplo.com.br>`. Sem elas, a tela de recuperação mostra o contato do suporte |
| `HOTMART_HOTTOK`, `HOTMART_PRODUCT_IDS` | Opcionais. Liberação automática pela Hotmart: o hottok da conta (Hotmart → Ferramentas → Webhook → Autenticação) e os IDs dos produtos que dão acesso, separados por vírgula. Sem elas, `/api/hotmart/access` responde 404 e o acesso é liberado só pelo painel |
| `EMAIL_OUTBOX_DIR` | Opcional. Grava os e-mails como arquivos JSON nessa pasta em vez de enviar; só em desenvolvimento e testes, recusado com `NODE_ENV=production` |
| `TEST_DATABASE_URL` | Só para `test:attribution`; banco vazio cujo nome termina em `_test` |

Sem DeepSeek ou Groq, chat e análise ficam indisponíveis com mensagem ao usuário. Em produção nada é simulado; em desenvolvimento e testes, `AI_PROVIDER=fake` responde o chat e gera levas de exemplo sem custo. CSV, webhook, métricas e exportação funcionam sem provedores de IA. Os IDs de modelo vêm só da configuração.

`npm run doctor` aponta configurações pendentes sem exibir valores (opções em [ativação](docs/ativacao.md#preparar-um-ambiente-novo)).

## Scripts

| Script | Função |
| --- | --- |
| `dev` | Servidor de desenvolvimento |
| `build` | Build do app (webpack), do worker e das ferramentas em `dist/tools` |
| `start` | Servidor standalone (`scripts/start.mjs`); exige `build` |
| `build:worker`, `worker` | Empacota e executa o worker |
| `db:generate`, `db:migrate` | Gera migration a partir do schema; aplica as pendentes |
| `storage:init` | Cria o bucket privado e o CORS de upload para a origem do app |
| `setup:env`, `doctor` | Cria `.env` local; diagnostica configuração (`--connections`, `--strict-providers`, `--production`, `--file`) |
| `lint`, `typecheck`, `test` | Oxlint com checagem de tipos (`.oxlintrc.json`), TypeScript e Vitest (benchmark, CSV e HMAC do webhook) |
| `test:attribution` | Migração e atribuição por campanha contra `TEST_DATABASE_URL` |
| `seed:demo` | Cria uma operação demo (oferta, leva, CSV e vendas do webhook) só em banco cujo nome termina em `_test`; login `demo@criativosvirais.test`, senha em `DEMO_PASSWORD` ou o padrão do script |
| `check:security` | Valida o fork local de `braces` ([detalhes](docs/dependencias-seguranca.md)) |

O CI roda `check:security`, `npm audit --audit-level=low`, `lint`, `typecheck`, `test`, `test:attribution` e `build`.

## Contratos

### Convenções das APIs

- Erros retornam `{ "error": "mensagem" }` em português, pronta para exibir.
- Dinheiro é inteiro em centavos e trafega como string decimal. Contagens grandes também são strings.
- Métrica ausente é `null`, nunca zero.
- `GET /api/creatives` responde `{ "rows": [...], "truncated": boolean }`; `truncated` indica mais de 1000 linhas.
- Mutações autenticadas exigem o header `Origin` igual à origem de `BETTER_AUTH_URL`.

### Anexos no chat

O cliente envia vídeos já enviados como metadados da mensagem do usuário:

```ts
sendMessage({ text, metadata: { assetIds: ["<uuid>"] } }); // até 5
```

O servidor confirma que cada asset é um vídeo da própria operação (400 se algum não for encontrado), salva a mensagem com os metadados e informa os IDs ao modelo numa cópia da mensagem que não aparece na conversa. Mensagens só aceitam partes de texto; áudio precisa ser transcrito antes.

### Acesso pela Hotmart

Na Hotmart, crie em Ferramentas → Webhook uma configuração versão 2.0.0 apontando para `https://SEU-DOMINIO/api/hotmart/access`, com os eventos de compra aprovada, completa, reembolsada e chargeback. A Hotmart manda o hottok no cabeçalho `X-HOTMART-HOTTOK`, conferido em tempo constante.

- `PURCHASE_APPROVED` e `PURCHASE_COMPLETE` liberam o e-mail do comprador (origem Hotmart no painel) e tiram um bloqueio que um reembolso anterior tenha posto.
- `PURCHASE_REFUNDED` e `PURCHASE_CHARGEBACK` bloqueiam a conta com o motivo e encerram as sessões; sem conta, removem a liberação. Contas da equipe nunca são alteradas, e um bloqueio feito pela equipe continua com o motivo dela (uma compra nova não o tira).
- Produtos fora de `HOTMART_PRODUCT_IDS` e os demais eventos são ignorados. Cada ação fica no registro do painel com o autor "Hotmart". Repetições da Hotmart não mudam nada.
- Cancelamento de assinatura ainda não bloqueia: falta decidir se o acesso termina na hora ou no fim do período pago.

### Webhook de vendas

Token e secret são gerados em Integrações e exibidos uma única vez. Gerar de novo revoga os anteriores.

```http
POST /api/ingest/events
Authorization: Bearer TOKEN
X-Webhook-Signature: sha256=HEX_HMAC_SHA256_DO_CORPO_BRUTO
Content-Type: application/json
```

```json
{
  "event_id": "order-123-paid",
  "occurred_at": "2026-10-13T15:00:00-03:00",
  "status": "approved",
  "currency": "BRL",
  "revenue": 99700,
  "profit": 65000,
  "creative_key": "L01-C01",
  "utm_campaign": "lancamento",
  "utm_content": "L01-C01"
}
```

- Campos aceitos: os acima mais `utm_source`, `utm_medium` e `utm_term`. Campos desconhecidos são recusados.
- Assine exatamente os bytes enviados com o secret (HMAC-SHA256, hexadecimal).
- `status`: `pending`, `approved`, `refunded`, `chargeback`, `cancelled` ou `failed`. Só BRL.
- `revenue` (não negativo) e `profit` em centavos inteiros; ausentes viram NULL e lucro pode ser negativo.
- Pagamento e reembolso precisam de `event_id` distintos. No reembolso ou chargeback, informe em `revenue`/`profit` a parcela revertida; ela é subtraída do aprovado.
- Datas com fuso horário, no máximo cinco minutos no futuro. Se `creative_key` e `utm_content` vierem juntos, devem coincidir; sem `creative_key`, `utm_content` é a chave.
- Eventos sem chave são guardados, mas não entram no ranking por criativo. Dias só com eventos pendentes, cancelados ou falhos ficam com contagens e valores NULL.
- Limites: corpo de 64 KB e 120 requisições por minuto por operação em cada processo.
- Respostas: 202 aceito (inclusive repetição idêntica), 400 contrato inválido, 401 credencial ou assinatura inválida, 409 `event_id` já recebido com outro conteúdo, 413 corpo grande, 429 limite temporário. Repita falhas transitórias com o mesmo `event_id` e o mesmo corpo; uma mudança (como um reembolso) precisa de um `event_id` novo.

### CSV

Importado em Integrações. Até 5 MB e 5000 linhas, uma linha por criativo e campanha no período. Não há nomes de coluna fixos: o usuário mapeia as colunas do arquivo para `creative_key` (obrigatória), `creative_name`, `campaign_key`, `adset_key` e as 14 métricas (`spend_cents`, `impressions`, `clicks`, `ctr`, `hook_rate`, `body_rate`, `leads`, `checkouts`, `approved_sales`, `revenue_cents`, `profit_cents`, `roas`, `refunds`, `chargebacks`), e informa período, separador decimal (vírgula ou ponto) e unidade monetária (reais ou centavos).

- Números sem símbolo de moeda, `%` ou notação científica; valores em reais com no máximo duas casas. Só lucro pode ser negativo.
- Hook Rate e Body Rate exigem a fórmula usada, que precisa ser a mesma nas importações seguintes.
- Importar o mesmo período e fonte substitui o snapshot; janelas sobrepostas são recusadas. Se um criativo tem mais de uma campanha, todas as linhas dele precisam da campanha.
- Na consulta, CSV exige o período exato importado; webhook soma os dias dentro da janela.

### UTMify

Usa `POST https://query-api.utmify.com.br/public-api/v1/dashboards/{dashboardId}/summary` com o token da API Oficial (na UTMify: Avançado → API Oficial → Novo Token; só nos planos Monster, Scale e Enterprise, em beta fechado), configurado em Integrações. As "Credenciais de API" da aba Integrações da UTMify são de envio de pedidos e não servem para a consulta. Chave recusada (401), conta sem a API (403) e dashboard inexistente (404) aparecem para o cliente com o que fazer, sem novas tentativas. A API devolve métricas consolidadas sem divisão por criativo, por isso o resumo nunca é distribuído entre anúncios. Quando a UTMify pede uma pausa (429), a próxima consulta espera o `Retry-After`. Consulte a [documentação oficial](https://docs.utmify.com.br/consulta-de-dados) para planos e limites.

## Isolamento e privacidade

- O tenant vem sempre da sessão no servidor (ou do payload de job criado pelo servidor). Consultas, atualizações e exclusões usam `tenantWhere(table, tenantId, ...)`; inserts usam `tenantValues(tenantId, values)` (`src/lib/tenant-scope.ts`). Jobs validam no worker que o registro pertence ao tenant do job.
- Chaves estrangeiras compostas `(tenant_id, id)` impedem vínculos entre operações. Não há RLS.
- Vídeos, transcrições, copy, contexto e aprendizados entram nos prompts delimitados como dados não confiáveis.
- Motivos de seleção de vídeos, entradas e saídas de ferramentas e raciocínio do modelo não chegam ao navegador.
- Credenciais de integração ficam cifradas com AES-256-GCM e nunca vão para o cliente, o modelo ou os logs. Mensagens que parecem conter chave ou token são recusadas no navegador e no servidor antes de serem salvas (`src/lib/secrets.ts`).
- Na visita de suporte a sessão é a do cliente, marcada com `impersonatedBy`, então o tenant continua vindo da sessão. Contas da equipe não podem ser acessadas.
- `shared_patterns` guarda apenas combinações de enums com uma frase fixa, sem texto ou números de clientes.
- ffmpeg e ffprobe rodam sem shell, só com protocolos `file`/`pipe`, demuxer definido pelo MIME, limites de duração e diretório temporário exclusivo.

## Deploy

A imagem do `Dockerfile` executa `node server.js` (app, porta 3000, healthcheck `/api/health`; o monitor externo consulta `/api/health/system`, que confere banco, worker e fila) e `node dist/worker.js` (worker). Migrations e bucket são aplicados com `node dist/tools/src/db/migrate.js` e `node dist/tools/scripts/init-storage.js`. Passo a passo para Compose e Coolify, atualização de versões e verificação dos provedores: [docs/ativacao.md](docs/ativacao.md).

## Limites conhecidos

- Sem verificação de email, redefinição de senha por email ou limite de webhook compartilhado entre réplicas.
- Dados permanecem enquanto a operação existir. Excluir uma operação exige remover o tenant (cascade no banco), o prefixo correspondente no bucket e os backups.
- Uploads: vídeo até 250 MB, áudio até 25 MB, duração máxima de 15 minutos.

## Documentação

- [Documento mestre (regras de negócio)](docs/documento-mestre.md)
- [Guia de ativação e deploy](docs/ativacao.md)
- [Dependências e segurança](docs/dependencias-seguranca.md)
- [Histórico](docs/historico.md)
