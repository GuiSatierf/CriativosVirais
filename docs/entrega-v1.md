# Entrega das seis fases da V1

A implementação das seis fases do pedido original está presente no repositório. A tabela distingue o código entregue das validações que dependem das contas externas do operador.

| Fase | Implementação entregue | Validação |
| --- | --- | --- |
| 1 — Setup | Next.js/shadcn, Postgres/Drizzle, Better Auth, tenants e Docker | Build, migrations, duas contas e isolamento local |
| 2 — Núcleo | Chat com histórico reabrível, contexto, geração/revisão, levas e DOCX | DeepSeek real para texto/visão e uma leva; exportação renderizada; histórico protegido por tenant e chat HTTP/streaming real |
| 3 — Mídia | Gravação/upload, RustFS, pg-boss, transcrição Groq, ffmpeg/frames e análise estruturada | S3/HEAD/CORS e ffmpeg/WebM; análise completa com transcrição depende da chave Groq |
| 4 — Métricas | CSV/mapeamento, tabela, top cinco das 14 métricas e solicitação privada de vídeos | Parser, SQL real, dinheiro exato, janelas/fontes/campanhas e privacidade |
| 5 — Integrações | Webhook HMAC/idempotente, worker de eventos, UTMify oficial e cron | Webhook/worker reais locais; consulta autenticada UTMify depende do acesso do operador |
| 6 — Aprendizado | Resultados com todas as métricas, CTR/ROAS derivados quando há denominadores, memória privada e abstrações compartilhadas | Totais exatos, taxas não agregáveis como NULL, evidência de CTR, rejeição sem dados/sem outra rodada e isolamento |

VK Metrics permanece desabilitado conforme o pedido original e a confirmação de que ainda não há documentação oficial validada. Não existe um endpoint fictício nem atribuição artificial de métricas consolidadas a criativos.

A preparação para ativação inclui `setup:env`, `doctor`, template de runtime de produção e [guia de ativação](ativacao.md). Os serviços locais usam a imagem de produção e volumes persistentes. Nenhuma conta externa, assinatura, domínio ou deploy em produção foi criado nesta preparação.

## Ao conectar os serviços

Configure Groq no runtime de app/worker e UTMify na tela Integrações. Substitua a chave DeepSeek compartilhada no chat antes do uso definitivo. Recrie os serviços para carregar variáveis novas e execute o diagnóstico dentro do worker. Faça a verificação final de áudio/vídeo e consulta UTMify com suas contas, conforme o guia.

A CI do GitHub está configurada; a execução anterior foi bloqueada pela cobrança/limite de gastos da conta. A validação local inclui lint, TypeScript, doze testes Vitest e build de produção. A aplicação não simula resultado de um provedor indisponível.

A [revisão completa](revisao-v1.md) detalha as correções posteriores, inclusive logs privados, reserva de chaves, contabilidade de eventos pendentes, concorrência da UTMify e limites do pipeline.
