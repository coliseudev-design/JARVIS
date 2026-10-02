# ADR 0001 — Stack modular e critérios de adoção

Data: 2026-10-02. Estado: decisão de arquitetura aceita para F01; compatibilidade instalada depende da evidência de build/testes. Responsável: A01; implementação A03/A13.

## Contexto e decisão

O repositório começa sem aplicação. O piloto precisa de duas identidades privadas, chat e memória, com um caminho de operação compreensível em VPS. Adotar monólito modular TypeScript: React/Vite na web, Fastify na API, worker separado para jobs e adaptador privado para Hermes. Manter `packages/contracts` como schemas de entrada/saída/eventos e `packages/policy` como política determinística. Um processo separado deve corresponder a isolamento ou ciclo de vida necessário, não a cada módulo de domínio.

Node.js 24 LTS é a linha adotada. A página oficial de releases foi acessada nesta execução e identifica a linha 24 como LTS; isso não verifica o patch instalado. A00/A13 registram o patch efetivamente executado e fixam dependências no lockfile. Versões de banco/extensão/runtime e digests de deploy têm de vir da execução, nunca de uma suposição deste ADR. Não usar `latest` em uma release homologada.

PostgreSQL guarda estado de negócio e outbox; Redis/BullMQ transportam trabalho e não autorizam acesso. Drizzle pode organizar migrations/query builders, com SQL explícito para RLS. Hermes recebe escopo resolvido pelo servidor através de `AgentRuntime`; não é servidor público de autenticação. Docker Compose é o alvo de desenvolvimento/staging e Coolify é o alvo de operação quando a VPS estiver identificada. Kubernetes, backend .NET paralelo e banco de grafos não entram na fundação.

## Comparação aplicada, sem pontuação não medida

| Responsabilidade | Escolha | Alternativa | Evidência/gate e custo a aferir |
|---|---|---|---|
| UI e contratos | Reutilizar React/Vite e bibliotecas acessíveis; desenvolver cockpit | Open WebUI/LibreChat como app completa | As referências não satisfazem por evidência a identidade visual/ownership requeridos; medir bundle, teclado e renderização F03 |
| API | Reutilizar Fastify/Node 24; desenvolver módulos do produto | .NET | Não há legado .NET que justifique duas linguagens de API; build/typecheck/contratos reais em F01 |
| Dados | Reutilizar PostgreSQL/pgvector; desenvolver ownership/ACL | Banco documental/grafo dedicado | Transações, integridade e RLS necessárias; medir retrieval no corpus F07 antes de especializar |
| Execução LLM | Reutilizar Hermes via adaptador | LangGraph | Não instalar segundo coordenador; spike de contenção, streaming e cancelamento é gate F05 |
| Filas | BullMQ + outbox PostgreSQL | Só Redis ou Temporal desde F01 | Outbox preserva intenção após queda; testar duplicatas. Temporal somente F16, com migração de rotinas |
| Voz | Experimentar LiveKit + Hermes + TTS na F10 | Pipecat/Realtime | Ainda não avaliado; escolher por interrupção, PT-BR, dados/custo/operabilidade |
| Memória | Desenvolver baseline PostgreSQL/pgvector | Hindsight/Mem0 | Uma fonte canônica; experimento temporal F17 antes de migração |
| Model gateway | Desenvolver contrato mínimo com adaptadores | LiteLLM | PoC posterior compara streaming/tool messages/usage; custos/edições não verificados |
| Documentos | Extração simples controlada | Docling | Comparar tabela/OCR num corpus sintético antes de ampliar workers |
| Observabilidade | OpenTelemetry, avaliar Langfuse | Logs/metrics próprios | Sem prompts/segredos por padrão; confirmar licença/edição, retenção e recursos antes de instalar |

Não há benchmark ou auditoria de fornecedor nesta decisão. Segurança/isolamento (25%), adequação (20%), recuperação (20%), manutenção/licença (15%), custo (10%) e UX/desempenho (10%) são pesos do plano para uma futura avaliação, não resultados. Critério desconhecido continua desconhecido; impedimento de isolamento elimina a opção independentemente de pontuação.

## Licença, versões e fontes

O lockfile reproduz resolução, mas não substitui revisão de licença. Antes de redistribuir código/imagem, o dono do pacote registra release/commit, arquivo LICENSE da versão, edição adotada e obrigações em sua evidência. A matriz acima não atesta a licença de versões ainda não instaladas. Imagens de PostgreSQL/pgvector/Redis também precisam dessa revisão; não presumir licença a partir do nome do produto.

Fontes primárias: [Node releases](https://nodejs.org/en/about/previous-releases) (consultada nesta execução); [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) e [BullMQ idempotency](https://docs.bullmq.io/patterns/idempotent-jobs) (tentativas nesta execução bloqueadas pelo proxy HTTP 403; referências do plano, não revalidação online). A avaliação Hermes está no ADR de A06. Demais fontes oficiais e hipóteses estão em `docs/PESQUISA_TECNOLOGICA.md`.

## Consequências e gates

F01 pode entregar instalação, schemas, health e banco de testes sem afirmar chat real. RLS em PostgreSQL real é gate F02; compatibilidade/isolamento Hermes é gate F05. Uma indisponibilidade externa não justifica apresentar fixture como integração. Contratos planejados ficam em `docs/contracts`; OpenAPI publicado deve conter apenas rotas efetivamente expostas. Cada dependência nova tem dono, motivo e custo operacional registrado.
