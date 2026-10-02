# ADR 0002 — Identidade de pessoa, recurso e executor

Data: 2026-10-02. Estado: decisão aceita; controle implementado/testado somente quando evidenciado em F02. Responsáveis: A01/A02.

## Decisão

Sessão opaca de servidor autentica uma pessoa. `tenant_id` delimita organização; `owner_user_id` delimita conteúdo privado dentro dela. Participação no tenant ou papel administrativo não concede acesso às conversas, memória, arquivos ou chaves de outro membro. A API recebe IDs de recurso como seletores, nunca como prova de identidade. Um ID inexistente e um ID inacessível produzem a mesma resposta 404 nas rotas de conteúdo.

O `AuthorizationContext` interno contém ator, sessão validada, tenant ativo verificado, modo de execução, recurso/dono e grants específicos. Ele não é aceito como DTO público. UUID/nomes de perfil enviados pelo browser não escolhem um home Hermes. O servidor resolve `agent_id → owner → runtime_profile_id` e `conversation_id → runtime_session_id`; mudança desses vínculos exige operação privilegiada explicitamente auditada.

Login usa Argon2id calibrado, convite/recuperação de uso único e sessões aleatórias persistidas por hash. Cookie `HttpOnly`, `Secure` em HTTPS e `SameSite=Lax`; CSRF token e validação Origin nas mutações autenticadas por cookie. Expiração/revogação é reavaliada inclusive em conexões longas. Sem bearer de sessão em localStorage. MFA administrativo antecede abertura pública; SMTP de laboratório não comprova recuperação por e-mail real.

## Aplicação aos dados e jobs

Tabelas privadas têm tenant e owner não nulos, chaves compostas e RLS para leitura/escrita (`USING` e `WITH CHECK`). Migration role separada; API/worker não são owners, superusers ou BYPASSRLS. Toda operação passa por transação com contexto `SET LOCAL`, inclusive leituras. Conexão devolvida ao pool não mantém identidade. Ausência de contexto falha fechado.

RLS é defesa adicional: usuário que consegue SQL arbitrário não deve poder escolher outro contexto; a aplicação não oferece SQL ao modelo. Downloads, cache, SSE, Redis, provider keys e homes Hermes implementam a mesma checagem. Chave de cache inclui escopo, grants/version e versão dos dados relevantes. Compartilhamento empresarial usa ACL explícita, sem promover memória pessoal a coletiva.

Outbox/fila guardam referências opacas, nunca segredo ou ator alegado pelo cliente. Worker recarrega job e mandato do banco, reavalia grants/revogação/budget e usa lease com fencing. Ator humano que iniciou a tarefa e sujeito de execução permanecem distintos na auditoria; um worker de sistema não herda poder administrativo sobre conteúdo.

## Alternativas descartadas e consequências

- Isolamento somente por tenant falha entre R e M na mesma empresa.
- Filtrar somente na UI deixa API, download e stream vulneráveis a troca de IDs.
- Perfil Hermes ou username Telegram como autenticação transfere autoridade a identificadores falsificáveis.
- JWT longo sem revogação não satisfaz logout/revoke imediato; sessões opacas simplificam o piloto.

Contexto, RLS e revogação aumentam consultas e exigem testes com role real. Não prometem E2EE contra administrador do host. Suporte com acesso a conteúdo, se existir, precisa de grant delimitado, prazo e auditoria; papel admin sozinho não é suficiente.

## Aceite

Executar canários R/M no mesmo tenant e tenants diferentes: APIs, SSE, files, fila, modelos, memória e runtime. Alternar as duas contas no mesmo pool, negar escrita com owner trocado, negar conteúdo ao admin operacional, invalidar sessão durante stream e conexão durante espera de aprovação. Testes de mocks não substituem PostgreSQL/RLS. A matriz e ameaças detalhadas pertencem a `docs/security/` (A02). Fonte primária: [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), cuja revalidação online ficou bloqueada pelo proxy nesta execução.
