# ADR 0003 — Memória canônica, versões e esquecimento

Data: 2026-10-02. Estado: decisão aceita para F06/F07; experimento comparativo F17 pendente. Responsáveis: A01/A07/A06.

## Decisão

PostgreSQL é fonte de verdade de perfil explícito, fatos aprovados, episódios e metadados de conhecimento. Histórico da conversa é outra camada; não é aprovação automática para memória permanente. Armazenar `owner`, origem autorizada, sensibilidade, confidence, versão, status e intervalo de validade. Confiança do modelo é metadado, não evidência. Uma correção aprovada supersede a versão anterior; consulta temporal explicita a data de interesse.

Hermes não mantém uma segunda memória canônica. Desabilitar escrita/leitura nativa redundante no piloto se a versão fixada permitir verificar a contenção. Preferir broker `memory.search` e `memory.propose`; `memory.update` só usa mandato/consentimento persistido. Se desabilitar não for verificável, F05/F06 ficam bloqueadas para memória persistente até uma projeção limitada, versionada e apagável passar nos testes. Não copiar todo o banco para arquivos de um home.

Cada run captura `memory_revision` e `persona_version`. Conteúdo recuperado é tratado como dado, com source refs e ACL; não concede instruções ou capabilities. Alteração de persona/fatos que afete snapshot Hermes invalida a sessão técnica e abre nova sessão com contexto autorizado. Histórico visual não precisa desaparecer por essa rotação.

## Escrita e exclusão

Propostas persistem separadas do estado aprovado. `memory.proposed` não significa “salvei”; confirmação depende de receipt após commit. Consentimento geral, se habilitado no futuro, delimita tipos/sensibilidade/retention e continua revogável. Chaves, tokens, cookies e instruções maliciosas de documentos nunca entram na memória.

Esquecimento é job durável: tombstone sem conteúdo sensível → bloquear retrieval imediatamente → remover itens/embeddings/projeções/caches → invalidar sessões e resumos capazes de restaurar o fato → verificar ausência → receipt de conclusão. Enquanto incompleto, mostrar “exclusão em andamento”. Não prometer remoção física de backups anteriores no instante do pedido; retenção de backups é explícita. Restore reaplica registro atual de tombstones/revogações antes de liberar acesso e mantém jobs restaurados pausados.

Busca começa híbrida lexical/vetorial com filtro de ownership/ACL antes da seleção. Chunks incluem documento/versão/página, embedding model e dimensões. Reindexação cria geração compatível, verifica completude e troca ponteiro; não mistura vetores de modelos diferentes. Second Brain usa apenas relações registradas e fontes acessíveis; grafo não é motivo para instalar outro banco.

## Reutilizar, desenvolver, experimentar

Reutilizar PostgreSQL/pgvector. Desenvolver consentimento, versões, memória temporal básica, tombstones e receipts. Hindsight/Mem0 permanecem candidatos F17: comparar no mesmo corpus sintético PT-BR, com mesmas políticas e queries de antes/agora, relevância, esquecimento, isolamento, latência e custo medidos. Não há notas comparativas nem licença/edição validada nesta fase. Candidato só substitui camada através de adaptador, export/migration/rollback e um único escritor canônico.

## Aceite e fontes

Preferência nova vence antiga; nova conversa/login mantém memória autorizada; canário M nunca chega ao modelo R; revogação de documento remove candidato e download; “esquecer” não reaparece após resumo, reinício ou restore. Dataset rotula conteúdo sintético e mede acerto com referências, sem alegar que memória melhora qualidade por definição.

Fontes de pesquisa, a revalidar na versão do spike: [Hermes memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory), [Hindsight](https://hindsight.vectorize.io/developer/api/main-methods), [Mem0](https://docs.mem0.ai/platform/features/graph-memory), [pgvector](https://github.com/pgvector/pgvector). Nenhum serviço comparador foi instalado ou medido por este ADR.
