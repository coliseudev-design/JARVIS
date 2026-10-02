# PostgreSQL: roles, ownership e pooling

Status: especificação F00 para A02/A03 implementarem e testarem em F02. Nenhum SQL deste documento foi executado como migration. RLS protege contra consulta sem filtro/IDOR sob contexto correto; não transforma uma API comprometida capaz de mudar contexto SQL em cliente confiável.

## Roles e privilégios

| Role lógica | Login / ownership | Privilégio e limite |
|---|---|---|
| `jarvis_owner` | NOLOGIN; dona dos objetos | Usada apenas pelo migrator via mecanismo explícito; nunca concedida à aplicação |
| `jarvis_migrator` | Login operacional separado | Pode assumir owner para migrations; indisponível em web, API, worker e Hermes |
| `jarvis_api` | Login; não dona | NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE; DML estritamente necessário |
| `jarvis_worker` | Login; não dona | Mesmas restrições; DML limitado aos módulos de execução; sem assumir API/owner |
| `jarvis_dispatcher` | Serviço interno de outbox | Apenas mecanismo restrito de claim/ack/referência; sem leitura geral de conteúdo |
| `jarvis_auth` | Módulo/serviço confiável de autenticação | Acesso mínimo a hashes, sessões e memberships, sem conteúdo pessoal |

Os nomes são proposta; A01/A03 fixam nomes de deployment. Revogar CREATE público no schema da aplicação, execução pública em funções privilegiadas e grants excessivos em sequências. API não recebe TRUNCATE, ALTER, REFERENCES arbitrário, criação de funções/extensões ou associação ao owner. Provisionador pode necessitar papel elevado para criar roles/extensões, mas não o reutiliza na aplicação.

Aplicar ENABLE ROW LEVEL SECURITY e FORCE ROW LEVEL SECURITY em toda tabela de conteúdo scoped. FORCE cobre o owner ordinário; superuser/BYPASSRLS continuam bypassando e nunca servem para provar isolamento. Inventário de teste deve verificar tanto flags da role quanto owner de cada tabela, policies por comando e permissões herdadas.

## Padrão de política e integridade

Tabelas privadas guardam `tenant_id` e `owner_user_id` NOT NULL. Política por operação exige ambos iguais ao contexto validado. UPDATE possui USING para a linha anterior e WITH CHECK para a resultante; INSERT possui WITH CHECK; SELECT/DELETE possuem USING. Default deny quando qualquer contexto estiver ausente/inválido. Não usar `OR is_admin()` para conteúdo privado.

Pseudocódigo de transação, a adaptar ao driver real:

```text
actor = sessionStore.validate(cookie)            // nunca pelo body
membership = membershipStore.require(actor, requestedWorkspace)
transaction(async tx => {                       // mesma conexão até commit/rollback
  await tx.parameterized("select set_config('app.tenant_id', $1, true)", membership.tenantId)
  await tx.parameterized("select set_config('app.user_id', $1, true)", actor.userId)
  return repository.readAuthorizedResource(tx, resourceId)
})
```

`true` aplica configuração local à transação. Interpolação de SQL com IDs é proibida. Todas as consultas de conteúdo, inclusive lazy loads, contagens, gravação de outbox e erro/retry, usam o handle `tx`; não usar pool global dentro do callback. Adquirir e liberar conexão manualmente sem transação não satisfaz o contrato. Sessão e membership precisam estar validadas antes da instalação do contexto; função `set_config` não autentica a pessoa.

Exemplo do predicado privado, não migration pronta:

```sql
tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
AND owner_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
```

GUC ausente ou vazio não autoriza linhas; UUID inválido pode falhar a transação e é erro interno sanitizado. Identidade deve ser sempre válida antes da query. Membership ativa é revalidada no servidor e nas operações sensíveis; quando a política consultar memberships, manter a consulta limitada e evitar recursão entre policies. Funções SECURITY DEFINER exigem revisão dedicada, schema qualification, search_path fixo e grants mínimos.

FKs compostas carregam scope no pai e filho: `UNIQUE(tenant_id, owner_user_id, id)` no recurso privado e `FOREIGN KEY (tenant_id, owner_user_id, conversation_id)` no filho. Anexos também verificam conversation/message; aprovações verificam run/tool_call. IDs globais podem continuar únicos, mas não bastam para impedir link entre donos. Erros de FK/unique não expõem existência de outro usuário; constraint checks podem revelar existência mesmo sob RLS, portanto sanitizar resposta.

Ownership é imutável por endpoint comum. Grants explícitos de coleção são tabela ACL distinta com recurso, sujeito, permissão e revogação. RLS/joins de ACL nunca mudam `app.user_id` para o dono do documento; isso concederia todos os seus recursos. Não reutilizar predicado privado cegamente para dados globais como catálogo público ou identidade/auth; cada tabela recebe política específica e teste correspondente.

## Pool e streams

- Iniciar com pool transacional do driver e PostgreSQL direto. PgBouncer transaction mode só entra após repetição da suíte; session/statement pooling não é presumido compatível.
- Testar pool com tamanho 1 para forçar R→M→sem contexto; incluir erro SQL, exceção do callback, rollback, cancelamento, timeout e conexão descartada. Uma transação abortada nunca volta ao pool em uso.
- Não manter transação aberta durante SSE, chamada de modelo, upload ou API externa. Cada lote de eventos usa nova transação scoped, e a sessão/run são reautorizados antes de emissão. Payload já enfileirado também precisa passar pelo gate de revogação.
- AsyncLocalStorage pode transportar metadados, mas não garante vínculo à conexão. Repositórios recebem `tx` explicitamente.
- Após commit/rollback, leitura de conteúdo sem contexto retorna zero linhas; tentativa de INSERT/UPDATE indevida falha ou altera zero, e nunca modifica dados alheios.

## Bootstrap de auth, outbox e jobs

Autenticar antes de ter `user_id` cria uma exceção inevitável de acesso: login precisa localizar hash/session. Usar acesso de autenticação mínimo por função/repository dedicada, sem expor listagem de usuários/hashes ao produto. Rate limit e resposta indistinguível para conta inexistente; validade e consumo único verificados atomicamente. A02 detalha a solução antes de F02; não desabilitar RLS globalmente para login.

Dispatcher precisa descobrir jobs de vários donos. Dar BYPASSRLS ao worker comum resolveria discovery destruindo isolamento. Em vez disso, mecanismo restrito de claim lê somente registros internos elegíveis e retorna `job_id`/lease/operação, sem corpos/segredos. O executor consulta o registro persistido por canal confiável, valida mandato/sujeito/estado e estabelece contexto para o trabalho. Um ID forjado em Redis não cria mandato. A descoberta e o resolver são superfície privilegiada e devem ser revistos em F05; workers F01 não executam jobs reais até esse gate.

Lease inclui token/fencing/version; o worker antigo não grava nem executa próxima ação após perda. Revalidação ocorre antes de efeito externo, mesmo se job foi autorizado originalmente. Mandato de rotina sobrevive a logout somente por autorização recorrente explícita; revogar esse mandato impede novas etapas.

## Checklist executável exigido para F02

Registrar comando, versão PostgreSQL/extensões, nome real da role de teste, `rolsuper`, `rolbypassrls`, ownership e schema revision. Rodar N01–N10 do [plano de testes](NEGATIVE_TEST_PLAN.md) com DB real. Teste executado apenas como owner ou mock não atende o aceite. A suíte deve consultar dados finais como fixture operator separado para provar que nenhuma alteração alheia aconteceu, sem usar esse operator na operação sob teste.
