# Estado do JARVIS

Atualizado em 03/10/2026. Escopo original F00–F20 preservado. Evidências são do ambiente cloud desta sessão, não da VPS. Código/Compose são publicados em `coliseudev-design/JARVIS`, branch `main`. CI remoto não confirmado: GitHub API negou a consulta. Configuração cloud foi salva como rascunho; isso não publica um snapshot.

| Marco | Estado real | Evidência / próximo gate |
|---|---|---|
| Planejamento F00–F20 | Entregue | `IMPLEMENTATION_PLAN.md`, 15 prompts A00–A14, ExecPlans por fase |
| F00 arquitetura/segurança | Entregue e revisada | ADRs, contratos, threat model, matriz, plano negativo e storyboard |
| F00 spike Hermes | Validado com provider sintético | 12 checks; upstream real, homes/XDG separados; `evidence/F00-hermes.md` |
| F01 fundação | Implementada e validada nativamente | Web/API/worker, PostgreSQL/pgvector/Redis, bootstrap e migrations repetíveis |
| F01/F02 Compose | Build e execução validados localmente | Digests fixados, serviços saudáveis, HTTP/isolamento/worker e persistência; `evidence/F02-containers.md` |
| F02 núcleo de identidade | Implementado e validado localmente | Convites/login/sessões/CSRF/MFA/perfil RLS, canários e navegador; `evidence/F02-identity.md` |
| F02 gates restantes | Pendentes | SMTP, recuperação de MFA perdido, administração completa, rate limit no edge e autorização dos futuros arquivos/SSE/jobs |
| F03–F06 MVP pessoal | Planejadas | UI completa, cofre/modelos, chat Hermes integrado, perfil/memória com esquecer |
| F07–F15 V1 | Planejadas | Documentos, tools, Google, voz, browser, Telegram, rotinas, auditoria e homologação |
| F16–F20 avançadas | Planejadas | Temporal/missões, memória temporal, multimodal, companion e escala |

## Comportamento disponível

Web PT-BR mostra capacidades reais, convite/login, recuperação por mailbox local, perfil privado com timezone e versão, sessões revogáveis, matrícula MFA e convite administrativo. Readiness exige schema2, vector, roles não-owner/sem BYPASSRLS, identidade e Redis. OpenAPI descreve rotas implementadas. Não há chat ou conexão fictícios.

Roles API, auth, worker, migrator e owner são distintas. Perfil tem RLS FORCE e contexto transacional tenant/user. Admin operacional não lê conteúdo de outras pessoas. Worker continua aceitando somente probes sintéticos; autenticação não habilita execução externa ou jobs pessoais.

## Execução por agentes

A00 coordena; A01 entregou arquitetura/contratos/storyboard; A02 segurança; A06 spike Hermes. Após limite de execução dos filhos, A00 integrou a fundação e escreveu o núcleo F02 como único escritor de schema/contratos/lockfile. A01 revisou F02 e apontou o agrupamento de IP pelo proxy e um deadlock na recuperação; as correções e limites estão na ADR0007 e evidências. Não houve quinze implementadores concorrentes.

## Pendências e próximo recorte

- Homologar Coolify/domínio público/VPS; containers passaram localmente, CI remoto permanece não confirmado.
- Completar gates operacionais F02 antes de uso público: entrega de e-mail, recuperação do segundo fator, administração e proteção no edge. Mailbox atual é de testes, sem SMTP.
- F03 começa a interface de trabalho; F04 adiciona providers/cofre; F05 conecta chat e Hermes. SSE, arquivos, memória e jobs pessoais precisam de testes próprios de isolamento quando existirem.
- Provider live, sandbox de processo/egress, broker, replay SSE e queda em execução continuam gates F05. Fixture F00 não prova esses itens.
- Domínio/VPS, contas Google/Telegram/voz e hardware Mac não foram configurados. Vídeos não foram anexados; storyboard deriva do texto.
- A implementação completa F00–F20 permanece em andamento; o Compose evolui junto às fases.
