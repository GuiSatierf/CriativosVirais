# Revisão completa da V1

Revisão realizada em 13/10/2026, confrontando o código com o documento mestre e o pedido de implementação. O registro cobre autenticação, schema/migrations, isolamento, APIs, chat e geração, memória, mídia, métricas, integrações, interface, exportação, dependências e execução/deploy.

## Problemas encontrados e corrigidos

| Área | Problema | Correção |
| --- | --- | --- |
| Chat/logs | O comportamento padrão de erros do streaming podia registrar detalhes de requisições com contexto privado | Callback registra somente mensagem fixa, sem erro bruto, prompt ou resposta do provedor |
| Chat/cancelamento | O limite declarado do Next não garantia duração total em uma instalação standalone; a geração podia continuar durante espera por lock | Deadline real de dez minutos propagado às ferramentas e verificação de cancelamento dentro da transação |
| Geração/atribuição | A próxima chave Lxx-Cxx podia coincidir com um criativo previamente importado; a leva nova ainda não possuía registro para receber vídeo | Escolha de rodada livre sob lock, reserva atômica em creatives e batch_items e disponibilidade imediata para upload |
| Provas/contexto | Alterações do contexto durante geração/revisão podiam deixar a copy baseada em informação revogada | Releitura bloqueada e comparação com o contexto usado; se mudou, a transação é recusada |
| Contexto | Texto composto apenas de espaços contava como oferta suficiente; edição do ticket precisava de tratamento consistente | Normalização das strings e atualização do campo numérico por input com limite de comprimento |
| Webhook/contabilidade | Eventos apenas pendentes, cancelados ou falhos viravam receita/lucro zero | Valores monetários permanecem NULL sem evento financeiro; aprovação e reversão continuam calculadas por dia |
| Webhook/campanha | Criativos já registrados sem campanha não recebiam o vínculo informado no primeiro evento | Primeira campanha conhecida preenche o vínculo vazio sem reatribuir os anteriores |
| Webhook/chaves | IDs e chaves compostos apenas de espaços podiam entrar como identificadores | Trim e rejeição de IDs/atribuição vazios |
| CSV/erros | Falhas do banco podiam ser apresentadas como erro de CSV e expor mensagens técnicas | Apenas erros de domínio conhecidos retornam 400; falhas internas são sanitizadas e retornam 503 |
| CSV/tamanho | Limite de caracteres não garantia 5 MB em UTF-8; transporte JSON podia rejeitar arquivos com muitas aspas; mapeamento aceitava campos desconhecidos | Limite em bytes, margem para escape JSON e somente campos de mapeamento previstos |
| CSV/números | Strings numéricas excessivas chegavam à conversão bigint; frações em contagens podiam lançar erro fora do Zod | Limites prévios e refinamento seguro sem converter texto inválido |
| UTMify/transação | Salvar credencial e enfileirar consulta eram operações separadas | Gravação e enqueue agora são uma transação |
| UTMify/concorrência | Resposta antiga podia sobrescrever conexão nova ou uma sincronização mais recente | Atualização condicionada à credencial criptografada e ao último sync observados antes da chamada |
| UTMify/backoff | Retry-After no formato de data HTTP era ignorado; atrasos longos eram limitados a um dia | Segundos e data HTTP respeitados, com piso de um minuto e validação do timestamp |
| UTMify/interface | O navegador tentou preencher credenciais de login no formulário de integração durante a revisão | Campo de chave indica new-password e campos possuem nomes/autocomplete próprios; nenhuma credencial preenchida automaticamente foi enviada |
| Mídia | Downloads/HEAD sem deadline podiam exceder o tempo útil de um job | Timeouts explícitos nos acessos S3 |
| Mídia/timestamps | Segmentos invertidos ou notas visuais após o fim do vídeo podiam ser armazenados | Ordem e limites validados antes de salvar |
| Microfone | Falha ao iniciar/gravar podia manter a faixa de áudio aberta | Liberação das tracks, timer e estado em falhas; gravação malsucedida não é enviada |
| Worker/deploy | Docker podia encerrar o processo antes dos trinta segundos pedidos ao pg-boss | Grace period de 35 segundos no Compose |
| Webhook/URL | URL do app com barra final podia produzir caminho duplicado | URL do endpoint montada com URL, sem concatenação de barras |

## Validação realizada

- ESLint, TypeScript, doze testes Vitest e builds de produção do app, worker e ferramentas. Novos testes se limitam a CSV e webhook, conforme o escopo solicitado.
- Postgres real: eventos pendentes, pagamentos e reembolsos; precisão de centavos; rollback quando o contexto muda; reserva de chaves sem colisão e registro de criativos gerados. Fixtures temporárias removidas.
- Respostas controladas de HTTP/IA: troca de credencial enquanto a consulta estava em andamento, Retry-After em data HTTP, geração/revisão e logging de erro sem o marcador privado. Esses cenários exercitam a integração do código; não são apresentados como chamadas reais aos provedores.
- Navegador: login com conta temporária, navegação, gravação e releitura do ticket/contexto e layout móvel do chat. Não houve gravação de áudio ambiente nem envio das credenciais preenchidas automaticamente pelo navegador.
- HTTP real no app atualizado: importação CSV de quase 5 MB com muitas aspas, rejeição de mapeamento desconhecido e origem inválida, webhook HMAC/idempotente e worker preservando NULL em eventos pendentes.
- Objeto S3 temporário real recusou leitura anônima com 403 e foi removido. Conta, dados e jobs concluídos da revisão foram removidos.
- Execução Docker e diagnóstico de Postgres, migrations e S3/CORS. As verificações anteriores de HMAC/idempotência com worker, upload real/HEAD, duas contas/isolamento, resultados/benchmark e renderização DOCX permanecem registradas na entrega.
- Auditoria de produção: zero vulnerabilidades conhecidas no resultado consultado. A árvore de desenvolvimento tem nove alertas associados ao advisory de braces; as sugestões do npm envolvem downgrades de ferramentas da stack e não foram aplicadas automaticamente.

## Limites da revisão e da ativação

Texto, visão, chat e geração DeepSeek tiveram chamadas reais verificadas na entrega anterior. Transcrição Groq, vídeo completo com Groq e consulta autenticada UTMify ainda dependem das credenciais/acessos do operador. VK Metrics continua desabilitado por falta de confirmação da API oficial. Produção no Coolify, domínios, backups/restauração e a rede pública do navegador precisam ser validados no ambiente de destino.

A V1 usa cadastro email/senha e limites de autenticação do Better Auth. Não inclui verificação de email, recuperação de senha, quotas de uso de IA, RLS ou um limite global de webhook entre réplicas. O webhook mantém o limite por processo documentado. Essas características devem ser consideradas ao abrir uma instalação pública; a revisão não adicionou cobrança, gestão de assinaturas ou recursos fora da V1.

A CI do GitHub segue configurada; o bloqueio anterior por cobrança/limite da conta impede tratá-la como execução aprovada. Revisão e testes locais não garantem ausência de todo defeito nem substituem as verificações com as contas e infraestrutura de produção.
