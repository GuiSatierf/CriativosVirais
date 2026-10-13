# Criativos Virais

V1 de uma ferramenta em que a IA atua como copywriter de anúncios em vídeo. A fonte de verdade de negócio é [`docs/documento-mestre.md`](docs/documento-mestre.md). O plano original e os contratos das etapas estão em [`docs/PROMPT-code-agent.md`](docs/PROMPT-code-agent.md).

## Funcionalidades implementadas

- Autenticação email/senha com Better Auth, criação automática de tenant e contexto, logout e páginas protegidas.
- Chat em streaming com Vercel AI SDK e DeepSeek; histórico persistido por conversa, contexto editável pela IA e pelo cliente e abertura em português. O servidor carrega o histórico da própria conta e ignora mensagens de assistente/tools fornecidas pelo navegador.
- Geração de levas estruturadas com Zod, contexto privado, documento mestre inteiro, memória recente e padrões anônimos. Uma segunda chamada verifica todos os critérios de qualidade; somente itens reprovados são regenerados e revistos antes de salvar.
- Levas com três hooks e corpo completo, chave `Lxx-Cxx` para `utm_content`, detalhes do teste recolhíveis, copiar e exportar `.docx` com tabelas no formato solicitado.
- Gravação de áudio pelo MediaRecorder e upload direto ao RustFS. O worker transcreve via Groq, e o chat envia a transcrição como texto quando está disponível; enquanto o chat estiver ocupado ou sem configuração, ela fica como rascunho.
- Upload de vídeos por chave de criativo ou como anexo avulso. O worker baixa para diretório temporário, usa ffprobe/ffmpeg para extrair áudio e até 40 frames de no máximo 768px, descreve os frames em lotes e salva análise estruturada com timestamps, blocos e incertezas. Arquivos temporários são removidos inclusive em falhas.
- CSV com Papa Parse, mapeamento de colunas, datas/decimal/unidade monetária explícitos, upsert de snapshots e tabela TanStack. Dinheiro permanece bigint centavos; ausências permanecem NULL. Fórmulas de Hook Rate/Body Rate são obrigatórias ao mapear essas métricas e ficam registradas por operação/fonte.
- Benchmark SQL com window functions: top cinco de cada métrica disponível, interseções e classificações internas de atenção versus venda, sem comparar operações diferentes ou usar limites universais.
- Webhook autenticado, HMAC-SHA256 do corpo bruto, idempotência por `event_id`, BRL/centavos/datas validados, rate limit em memória por tenant e processamento pg-boss. Evento e enqueue são uma única transação; responder 202 confirma aceitação durável. A fila atualiza snapshots diários a partir dos eventos, incluindo reembolsos e chargebacks.
- Conector UTMify para o endpoint oficial de resumo, credenciais AES-256-GCM, sincronização manual e cron a cada seis horas. O resumo não é atribuído a criativos.
- Resultados das levas por janela/fonte, aprendizados privados com níveis de evidência e reutilização na próxima geração. Repetição exige outra rodada comparável; padrões compartilhados usam somente enums finitos e uma frase abstrata fixa, sem nomes, frases privadas ou números da operação.

Não há edição/renderização de vídeos, publicação de anúncios nem alterações de campanhas. O conector VK Metrics permanece desabilitado até confirmação de uma API pública oficial, conforme solicitado.

## Requisitos e configuração local

Node.js 22+, npm, Docker e Docker Compose. O lockfile fixa a árvore de dependências.

```sh
npm ci
cp .env.example .env
```

Preencha `.env` antes de iniciar:

- `POSTGRES_PASSWORD` e `DATABASE_URL`: credenciais correspondentes. Prefira senha hexadecimal ou faça URL-encoding de caracteres especiais na URL.
- `BETTER_AUTH_SECRET`: segredo aleatório de pelo menos 32 caracteres; `BETTER_AUTH_URL`: URL exata do app, usada como origem confiável.
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_ENDPOINT`: RustFS privado. `S3_PUBLIC_ENDPOINT` é a URL do mesmo serviço alcançável pelo navegador e usada na assinatura de PUT. O endpoint interno pode usar o hostname Docker.
- `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL_TEXT`, `DEEPSEEK_MODEL_VISION`: chave e IDs de modelos disponíveis na sua conta. O modelo de imagem precisa aceitar imagens de fato. Nenhum ID é hardcoded. Confirme os modelos na [documentação DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/).
- `GROQ_API_KEY`, `GROQ_WHISPER_MODEL`: chave e modelo de transcrição disponíveis na sua conta, conforme [Groq Speech to Text](https://console.groq.com/docs/speech-to-text).
- `ENCRYPTION_KEY`: exatamente 32 bytes codificados em base64, para criptografar integrações. Guarde-a junto dos backups de forma segura; trocar a chave sem migrar os ciphertexts impede a leitura das credenciais existentes.

Gere segredos localmente:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

```sh
docker compose up -d --wait postgres rustfs
npm run db:migrate
npm run storage:init
npm run dev
```

Em outro terminal:

```sh
npm run build:worker
npm run worker
```

Abra `http://localhost:3000/signup`. Sem chaves/modelos configurados, o chat fica explicitamente indisponível e a análise retorna um erro de configuração; nenhuma resposta/análise é simulada. CSV, webhook, métricas e exportação podem ser usados sem provedores de IA.

Portas locais: app `3000`, Postgres `55432`, RustFS S3 `9000` e console `9001`, todas limitadas a loopback no Compose. Altere `POSTGRES_PORT` e a URL no host quando necessário. O Compose injeta os hostnames internos em app/worker e preserva o endpoint público das assinaturas.

`storage:init` cria um bucket privado e configura CORS somente para a origem de `BETTER_AUTH_URL`. O bucket nunca fica público. Em produção, use HTTPS tanto no app quanto no S3 para evitar bloqueio de mixed content.

## Execução completa com Docker

```sh
docker compose build app
docker compose up -d --wait postgres rustfs
docker compose run --rm --no-deps app node dist/tools/src/db/migrate.js
docker compose run --rm --no-deps app node dist/tools/scripts/init-storage.js
docker compose --profile full up -d app worker
```

A mesma imagem executa `node server.js` no app e `node dist/worker.js` no worker. Ela inclui ffmpeg, migrations e documento mestre, roda como usuário sem privilégios e não precisa de segredos ou banco no build. As tarefas pontuais de migration/bucket não são serviços permanentes.

```sh
docker compose logs -f app worker
docker compose stop
```

Volumes persistem ao parar/recriar serviços. Faça backup antes de remover volumes ou aplicar migrations futuras.

## Fluxo de uso

1. Conte sobre produto, público, transformação, mecanismo, ticket e próximo passo na conversa. Revise provas autorizadas e restrições em Configurações.
2. Em Integrações, importe CSV ou conecte webhook. UTMify é opcional e fornece somente resumo; ranking precisa de chave estável por criativo.
3. Informe na conversa período e fonte/campanha. A IA consulta o ranking internamente e solicita apenas as chaves dos vídeos escolhidos. Motivos da seleção e chamadas internas nunca são enviados no stream/UI.
4. Envie os vídeos solicitados e aguarde análise. Peça uma leva após completar o contexto. A geração revisa a qualidade antes de salvar; copie ou exporte os roteiros em Levas.
5. Use cada `creative_key` como `utm_content` ao publicar manualmente. Retorne resultados com CSV ou webhook e peça à IA para consultar a leva e salvar aprendizados compatíveis com a evidência.

CSV aceita até 5 MB/5000 linhas, uma linha por criativo no período. Campos numéricos não aceitam símbolos de moeda/% ou notação científica. Escolha decimal vírgula/ponto e reais/centavos. Snapshots no mesmo período/fonte substituem valores; janelas sobrepostas são rejeitadas para evitar dupla contagem. O filtro CSV exige o período exato importado; webhook soma dias dentro da janela. Não combine fontes na mesma comparação. Hook Rate e Body Rate não são inventados a partir de vídeos; sem denominadores comuns não são agregados entre snapshots.

Uploads aceitam até 250 MB para vídeo e 25 MB para áudio, com duração máxima de 15 minutos. Vídeos longos têm frames amostrados ao longo da duração inteira com intervalo mínimo de dois segundos; os limites da evidência visual devem aparecer nas incertezas da análise. O gravador do chat limita mensagens a dois minutos. Falhas de jobs têm até três retries, backoff e opção de reenfileirar um asset em erro. App/worker devem usar a mesma versão do schema.

## Contrato do webhook

Gere token e secret em Integrações; eles são exibidos uma única vez. Regenerar revoga a credencial anterior; revogar conexão remove sua autenticação. A aplicação nunca retorna esses segredos em consultas posteriores.

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
  "utm_content": "L01-C01"
}
```

Assine exatamente os bytes enviados, incluindo espaços. Estados: pending, approved, refunded, chargeback, cancelled, failed. BRL é a moeda da V1; não há mistura/conversão automática de moedas. Valores ausentes viram NULL; lucros podem ser negativos. Pagamento e reembolso precisam de `event_id` distintos. Informe a parcela reembolsada/estornada em revenue/profit de seus eventos de reversão; o worker a subtrai do aprovado. Datas devem ter timezone e não podem exceder cinco minutos no futuro. Se creative_key e utm_content existirem, precisam coincidir. Eventos sem chave são armazenados, mas não viram ranking por criativo.

Limites: corpo 64 KB e 120 requisições/minuto por tenant **por processo**. Respostas: 202 aceito (inclusive repetição), 400 contrato inválido, 401 autenticação/assinatura inválida, 413 corpo grande, 429 limite temporário. Faça retry de falhas transitórias usando o mesmo event_id; nunca altere o significado de um ID já aceito. A deduplicação impede processamento duplicado do mesmo evento, mas não deduz que dois IDs diferentes representam a mesma venda.

## UTMify e VK Metrics

O endpoint documentado é `POST https://query-api.utmify.com.br/public-api/v1/dashboards/{dashboardId}/summary`, com chave oficial e ID do dashboard. Ele retorna métricas consolidadas em centavos, sem granularidade documentada por utm_content/creative_key; não inventamos um endpoint ou distribuição por anúncio. A consulta exige plano elegível e acesso ao beta. Erros ficam visíveis na integração e retries usam backoff de no mínimo um minuto e respeitam Retry-After sem novas chamadas antes do prazo; o cron roda a cada seis horas. Consulte a [documentação oficial](https://docs.utmify.com.br/consulta-de-dados) para elegibilidade e limites atuais. VK Metrics tem interface e TODO e não faz chamadas até confirmação do usuário.

## Coolify

1. Conecte o repositório privado/branch aprovada; build via Dockerfile, porta interna 3000, domínio HTTPS e healthcheck `/api/health`.
2. Crie Postgres 17 com volume e hostname interno; não publique a porta do banco.
3. Crie RustFS com a imagem fixada por digest no Compose, volumes `/data` e `/logs`, credenciais únicas e CORS restrito à origem do app. Exponha S3 por HTTPS; restrinja o console.
4. Configure variáveis no app/worker como segredos de runtime, nunca build args. Use URLs internas para banco/S3 e o domínio público S3 para assinaturas.
5. Execute `node dist/tools/src/db/migrate.js` uma vez antes de servir tráfego e `node dist/tools/scripts/init-storage.js` com RustFS disponível. Não rode migrations concorrentes a cada startup de réplica.
6. Execute o worker da mesma imagem, comando `node dist/worker.js`, sem domínio/porta pública e com acesso à mesma rede. Permita jobs de até 30 minutos e desligamento gracioso; o proxy do app precisa permitir streaming e geração longa sem timeout curto.
7. Valide cadastro, chat, uma geração pequena, áudio/vídeo, CSV, webhook assinado e sincronização com credenciais reais, além da persistência após reiniciar.

Não existe deploy automático ou alteração de produção neste PR. Faça backup de Postgres/RustFS e da chave de criptografia antes de atualizar.

## Isolamento e memória

Identidade do tenant vem da sessão no servidor; APIs de sessão validam origem nas mutações. Helpers `tenantWhere`/`tenantValues` estão disponíveis, e serviços internos recebem o tenant resolvido pelo servidor e aplicam filtros explícitos em todas as queries. IDs de rota, jobs e vínculos passam por validação/propriedade. Vínculos compostos `(tenant_id,id)` impedem referências entre operações. Não há RLS nesta V1.

A geração de levas recebe o texto recente da conversa e as análises dos vídeos selecionados ou referenciados por asset_id, sempre filtrados pelo tenant. Os motivos de seleção permanecem privados. Cancelar a conversa também interrompe as chamadas de geração/revisão pendentes. O histórico de assistente/tools fornecido pelo front não entra no contexto. Conteúdo de clientes, transcrições, imagens, contexto e aprendizados é delimitado como dado não confiável. Nenhuma ferramenta recebe credenciais de integração; inputs/resultados de tools e reasoning são removidos do stream público. A extração ffmpeg/ffprobe usa argumentos sem shell, somente protocolos file/pipe, demuxers forçados pelo MIME para recusar playlists, limites de duração/timeout e diretórios temporários exclusivos.

`shared_patterns` recebe apenas estruturas/consciência de enums e frases fixas anônimas; aprendizado privado nunca é copiado para lá. Mesmo um padrão observado é tratado como hipótese na próxima operação. Dados permanecem enquanto a conta/operação existir; a V1 não implementa expiração automática. Exclusão administrativa solicitada deve abranger tenant (cascade no banco), prefixo S3 correspondente e backups conforme a política do operador. Jobs de assets removidos deixam de processar registros ausentes. Não há reset de senha/verificação de email: requer serviço de email e escopo adicional.

## Validação e limitações

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run db:generate
npm audit --omit=dev
```

Vitest cobre somente benchmark, CSV e HMAC/contrato do webhook, conforme o escopo solicitado. A revisão final verificou as 14 métricas no Postgres, precisão de centavos acima do limite seguro de JavaScript, ranking de reembolsos/chargebacks com menor valor primeiro, filtro de campanha nos resultados e evidência de vídeo no contexto da geração. Gravações WebM sem duração no cabeçalho foram verificadas com ffmpeg/ffprobe e usam uma leitura limitada dos timestamps dos pacotes. Smoke checks locais exercitaram duas contas, isolamento, migrations, upsert/ranking SQL, exportação real de DOCX com render das páginas, ingestão HMAC/idempotente com worker real, assinatura/upload/HEAD de S3, tratamento explícito de provedores não configurados, memória privada e privacidade do card de seleção. Interfaces foram verificadas no navegador, inclusive viewport móvel.

Chamadas reais DeepSeek de texto, visão e geração de uma leva de um criativo passaram, incluindo revisão de qualidade e persistência. Respostas fora do schema ou ainda reprovadas após regeneração são recusadas sem salvar a leva. O teste usou uma operação fictícia temporária, removida ao terminar. Sem chave Groq e acesso UTMify, transcrição, análise completa de vídeo e consulta autenticada ao dashboard permanecem sem validação real. Seus caminhos estão implementados e falham explicitamente quando indisponíveis. A CI do GitHub está configurada, mas a execução anterior foi bloqueada pela cobrança/limite de gastos da conta.

A auditoria de produção não apresenta vulnerabilidades conhecidas. Ferramentas de desenvolvimento ainda reportam o advisory de braces GHSA-vfj7-8cjw-p6xm, sem versão corrigida disponível no registry consultado. O esbuild transitivo do loader Drizzle usa um override validado para remover o advisory da versão antiga, preservando a stack.

Os IDs atuais devem ser confirmados na [documentação DeepSeek](https://api-docs.deepseek.com/guides/vision/); ela documenta `deepseek-flash` com entrada de imagem. Configure os IDs em DEEPSEEK_MODEL_TEXT/DEEPSEEK_MODEL_VISION; eles não ficam fixados no código. Credenciais devem entrar diretamente no `.env` ignorado ou nos segredos de runtime; substitua qualquer chave publicada em um chat.
