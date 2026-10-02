# Evidência F01 — fundação nativa e configuração Compose

Data: 02/10/2026. Ambiente cloud Debian 13 x86_64, Node 24.19.0. Repositório começou sem commits. Versões detalhadas em `F00-versions.md`.

| Comando/check executado | Resultado |
|---|---|
| `npm ci --ignore-scripts` | Dependências por lockfile; sem alteração de resolução |
| `npm run build` | Passou em contracts/policy/database/API/worker/web; bundle web gerado |
| `npm run typecheck` | Passou em seis workspaces |
| `npm test` | 2 arquivos, 5 testes passaram; contratos estritos, sequência segura, erro saneado, readiness, OpenAPI, fail-closed |
| `bash scripts/with-dev-env.sh npm run test:integration` | 1 arquivo, 3 testes passaram com PostgreSQL/pgvector + Redis reais |
| `python3 scripts/test-fresh-database.py` | Cluster temporário vazio, mesmo init-db do Compose, extensão e migration duas vezes passaram; cluster removido após parada |
| `python3 scripts/local-services.py` repetido | Reutilizou banco/roles/configuração existentes sem apagar dados |
| API/web/worker via entrypoints compilados | Processos iniciaram; requests internos à web retornaram HTML, readiness 200, status e OpenAPI corretos |
| `node scripts/container-smoke.mjs` via configuração de desenvolvimento | Fila → worker em processo separado → registro no PostgreSQL passou |
| `docker compose ... config --quiet` | Schema Compose validado, variáveis descartáveis sem imprimir valores |
| `npm audit --omit=dev --audit-level=high` | Retornou 0 vulnerabilidades conhecidas nessa execução; não equivale a auditoria de segurança |
| `docker compose ... build api` | Bloqueado: Docker Hub 429 ao carregar metadata Node; nenhum container do produto homologado |

Integração verifica distância vetorial real, migration única, API sem privilégio CREATE/INSERT/SET ROLE owner, persistência idempotente do probe e recusa de owner livre na mensagem da fila. Tabelas de conteúdo pessoal/RLS, auth e chat não existem ainda e não estão cobertos por esses testes.

O primeiro build encontrou typing `unknown` no handler de erros do Fastify; o handler foi corrigido com narrowing e o build passou. O primeiro acesso npm falhou porque o home era somente leitura; cache foi direcionado ao workspace. Docker Hub limita pulls; mirrors retornaram 403. Fallback Debian utiliza assinatura/hash oficial, sem execução root, com arquivos privados gerados localmente. Nenhuma falha de infraestrutura foi transformada em skip descrito como pass.

O modo `foundation` do Compose libera apenas rotas operacionais de leitura e informa recursos indisponíveis. Não é modo de produção com identidade. O web proxy tem origem fixa no servidor, não aceita destino arbitrário pelo request e não encaminha mutações nesta fase. Readiness/health não indicam que o JARVIS completo foi entregue.

CI versionado executará `npm run check`, Compose completo e probes; existência do YAML não comprova execução no GitHub. Domínio, TLS, limites da VPS, backup/restore operacional e rollback de release continuam pendentes de staging/F15. Não houve deploy nesta sessão.
