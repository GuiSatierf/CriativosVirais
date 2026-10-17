# Histórico

## V1

Implementação das seis fases do plano. Uma fase só conta como feita quando o fluxo dela passa no job `e2e` da CI (Playwright com `AI_PROVIDER=fake`). Ter o código não basta. Na coluna Validação:
- **validado**: coberto pelo e2e;
- **pendente**: ainda sem teste de ponta a ponta;
- **fora do escopo agora**: depende da Groq, que não está em uso.

| Fase | Entrega | Validação |
| --- | --- | --- |
| 1. Setup | Next.js, shadcn/ui, PostgreSQL com Drizzle, Better Auth, tenants e Docker | Validado: cadastro cria a conta e a operação (`e2e/support.ts`) |
| 2. Núcleo | Chat com histórico, contexto, geração e revisão de levas, exportação `.docx` | Validado com a IA falsa: chat, oferta salva, leva e `.docx` (`e2e/chat-batch-export.spec.ts`). Pendente: rodada com a DeepSeek real |
| 3. Mídia | Gravação e upload, RustFS, pg-boss, transcrição, extração de frames e análise estruturada | Fora do escopo agora |
| 4. Métricas | Importação CSV, tabela de criativos, ranking das 14 métricas e pedido privado de vídeos | Validado: CSV, tabela e ranking (`e2e/csv-ranking.spec.ts`). Fora do escopo agora: pedido de vídeos |
| 5. Integrações | Webhook HMAC idempotente, worker de eventos, UTMify e cron | Validado: webhook assinado e worker (`e2e/webhook-batch-results.spec.ts`). Pendente: UTMify e cron |
| 6. Aprendizado | Resultados por leva, CTR e ROAS derivados, memória privada e padrões anônimos | Validado: resultados por leva vindos do webhook (`e2e/webhook-batch-results.spec.ts`). Pendente: memória privada, padrões anônimos e uso dos resultados na leva seguinte. Fora do escopo agora: o que usa análise de vídeo |

### Revisão da V1

- Logs de erro de streaming e jobs sem prompts, payloads ou mensagens brutas de provedores.
- Prazo real de dez minutos no chat, propagado às ferramentas de geração.
- Reserva atômica das chaves `Lxx-Cxx` e recusa da leva quando o contexto muda durante a geração.
- Eventos só pendentes, cancelados ou falhos não viram receita ou lucro zero.
- Atribuição por campanha nos snapshots do webhook (migration `0002`), com recálculo a partir dos eventos.
- CSV preserva nome, campanha e conjunto já conhecidos quando as colunas não são mapeadas; recusa campanhas ambíguas e janelas sobrepostas.
- Limite de 5 MB do CSV medido em bytes; números validados antes da conversão para bigint.
- Gravação da credencial UTMify e enfileiramento na mesma transação; resposta antiga não sobrescreve uma conexão nova; `Retry-After` em segundos ou data HTTP.
- Timeouts nos acessos ao S3 e validação dos timestamps da análise de vídeo.
- Fork local de `braces` para GHSA-vfj7-8cjw-p6xm ([detalhes](dependencias-seguranca.md)).

### Auditoria pós-V1

- Isolamento por `tenantWhere`/`tenantValues` em rotas, domínio e jobs; jobs validam a posse no worker.
- Contagens de vendas, reembolsos e chargebacks do webhook ficam NULL quando o dia não tem evento liquidado.
- Sincronização UTMify com um job por integração; pausa pedida pelo provedor não conta como falha.
- App com cliente pg-boss só de envio; filas, manutenção e cron ficam no worker.
- Importação CSV em lote (consultas por bloco de 500 linhas) com as mesmas regras de sobreposição.
- Mensagens de erro ao usuário sem detalhes internos; detalhes técnicos só no log do servidor.
- Anexos de vídeo no chat por `metadata.assetIds`; o histórico deixa de ser enviado duas vezes ao modelo.
- Configuração validada por grupo em `src/lib/env.ts`.
- Títulos de leva no formato `Leva 03 · Produto · 14/10/2026`; `GET /api/creatives` informa `truncated`.
- Remoção de índices duplicados em `client_contexts` (migration `0003`) e de dependências sem uso (`clsx`, `tailwind-merge`, `radix-ui`, `@ai-sdk/groq`, `@tanstack/react-table`) e do stub VK Metrics.

### Interface

- Barra lateral no desktop e menu lateral no celular; páginas Conversa, Levas, Criativos, Integrações e Configurações.
- Tema neutro claro e escuro com preferência persistida; fonte Inter; lilás da marca só no logo (`public/brand`).
- Transcrição do áudio vai para o campo de mensagem para revisão, sem envio automático.
- Preço do produto em reais (salvo em centavos), glossário das métricas e rótulos em português simples (Gancho 1/2/3, Estrutura).
- Página `/recuperar-senha` com orientação de contato com o suporte; não há redefinição por email.
