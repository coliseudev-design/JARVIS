# Contrato alvo da API da aplicação v1

Estado: especificação F00 para implementação incremental F01–F08. Estas rotas não são uma alegação de endpoints já implementados. `GET /api/v1/system/status` e o OpenAPI publicado pelo servidor devem distinguir disponibilidade real. Responsáveis: A01 define; A03 implementa schemas em `packages/contracts` e API; A02 revisa autorização.

## Convenções obrigatórias

Prefixo de produto `/api/v1`; IDs opacos UUID; datas RFC3339 UTC, timezone IANA separado quando relevante. JSON UTF-8, schemas estritos com campos extras rejeitados. IDs de tenant/owner/runtime não são aceitos como identidade no corpo/query/header de rotas públicas. Uma seleção de tenant só é aceita em operação própria que verifica membership e troca contexto de sessão. IDs de recurso continuam sujeitos a autorização.

Sessão opaca em cookie HttpOnly, CSRF + Origin em mutações autenticadas por cookie. O alvo público exige rate limit de login/recuperação por conta normalizada e origem confiável, sem mensagem que enumere cadastro. No piloto F02, há limite por conta/token e circuito global explícito; o IP do proxy privado não é identidade do cliente (ADR0007). Recurso privado ausente/inacessível retorna 404, inclusive no futuro run de SSE. Rotas administrativas podem retornar 403 por falta de papel, mas papel não libera conteúdo.

Limites iniciais de produto (configuráveis para baixo; não benchmarks): JSON 256 KiB; mensagem de texto 32 KiB UTF-8; até 10 anexos já autorizados; `limit` de lista 1–100, padrão 25. Upload tem endpoint/pipeline separado e limite inicial 20 MiB por objeto, quota por owner aplicada atomicamente; o parser não precisa aceitar esse tamanho nas demais rotas. Números/tamanho/cursor inválidos retornam 400/413. Conteúdo de erro não reproduz payload, SQL, segredo ou resposta bruta de fornecedor.

Paginação keyset com ordenação estável `(created_at,id)`, cursor opaco vinculado à coleção/filtros/escopo e integridade autenticada; cursor não autoriza nada. Response `{items, next_cursor}`. Ao revogar acesso, item desaparece independentemente de cursor antigo.

`X-Correlation-ID` é gerado no servidor; valor recebido só pode ser reaproveitado se formato/tamanho válidos. Resposta de erro:

```json
{"error":{"code":"RESOURCE_NOT_FOUND","message":"Recurso não encontrado.","correlation_id":"00000000-0000-4000-8000-000000000001","retryable":false}}
```

Códigos estáveis: `INVALID_REQUEST` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `RESOURCE_NOT_FOUND` (404), `CONFLICT`/`IDEMPOTENCY_CONFLICT`/`VERSION_CONFLICT` (409), `CURSOR_EXPIRED` (410), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `CAPABILITY_UNAVAILABLE` (503), `DEPENDENCY_UNAVAILABLE` (503), `INTERNAL_ERROR` (500). `Retry-After` quando a espera puder ser estimada; não marcar efeito externo incerto como retryable.

## Health e disponibilidade — F01

| Rota | Resposta/semântica | Acesso |
|---|---|---|
| `GET /health/live` | 200 se processo atende; não consulta providers | Público, sem detalhes internos |
| `GET /health/ready` | 200 somente se dependências obrigatórias configuradas e schema compatível; 503 caso contrário | Público, razão genérica |
| `GET /api/v1/system/status` | Versão de schema e capacidades `available`, `unavailable`, `not_configured` ou `development_only`; `mode` explícito | Público somente dados não sensíveis; nenhum path/host/secret |

Não tratar banco ausente como ready. Se modo local sem serviços existir, identificá-lo explicitamente; não equivale a readiness do produto. Status de recurso experimental não prova autorização do usuário e não substitui checks por operação.

## Identidade — F02

Rotas abaixo implementadas no núcleo piloto; prefixo `/api/v1` omitido na tabela. Schemas executáveis ficam em `packages/contracts`. Metadados de dispositivo/último uso, troca de workspace e recuperação de MFA perdido continuam fora desta entrega.

| Rota | Entrada mínima | Saída/efeito |
|---|---|---|
| `POST /auth/login` | email, password, code TOTP quando ativo | 200 `{authenticated:true}` + cookie; 401 genérico |
| `POST /auth/logout` | CSRF | 204 após revogar sessão atual |
| `GET /me` | sessão | user/tenant/email, papel, flags MFA, csrf_token, perfil nome/fuso/versão |
| `GET /profiles/{id}` | sessão | somente perfil próprio; 404 caso inacessível |
| `PATCH /me/profile` | display_name, timezone, expected_version, CSRF | perfil atualizado; 409 em versão desatualizada |
| `GET /auth/sessions` | sessão | sessões próprias ativas: id, created_at, expires_at, current |
| `DELETE /auth/sessions/{id}` | CSRF | revoga sessão própria, 204 idempotente |
| `POST /auth/invitations/accept` | token, display_name, password | 201 `{authenticated:true}`; token consumido uma vez; cookie de sessão nova |
| `POST /auth/recovery/request` | email | 202 genérico mesmo se conta ausente |
| `POST /auth/recovery/complete` | token, password, code TOTP quando ativo | 204, token consumido uma vez e sessões anteriores revogadas |
| `POST /auth/mfa/start` | password, CSRF | secret e otpauth_uri para matrícula após reautenticação |
| `POST /auth/mfa/confirm` | code, CSRF | 204, ativa MFA e revoga outras sessões |
| `POST /administration/invitations` | email, role, CSRF; admin com MFA | 202 invitation_id e delivery local_test_mailbox; sem token |

Convites/recuperações são entregues na mailbox privada de laboratório. Links usam fragmento de URL, removido pela UI ao ler o token; tokens não aparecem em GET URLs de API, logs ou telemetria. A origem HTTPS configurada determina cookie Secure com prefixo __Host-. Abertura pública depende dos gates descritos em STATUS/ADR0007.

## Conversa e runs — F05

| Rota | Entrada | Saída/efeito autorizado |
|---|---|---|
| `POST /conversations` | título opcional, `agent_id` próprio | 201 `{conversation_id, created_at}` |
| `GET /conversations` | cursor, limit | lista privada |
| `GET /conversations/{id}/messages` | cursor, limit | mensagens, source refs e anexos próprios/autorizados |
| `POST /conversations/{id}/messages` | `Idempotency-Key`; `{text, attachment_ids:[]}` | 202 `{message_id, run_id, state:"queued", events_url}` após commit |
| `GET /runs/{id}` | sessão | estado, versão, timestamps, erro saneado, receipts autorizados, modelo solicitado/servido e uso conhecido |
| `GET /runs/{id}/events` | `Last-Event-ID` opcional | SSE conforme `events-v1.md` |
| `POST /runs/{id}/cancel` | `Idempotency-Key`, CSRF | 202 solicitação persistida, ou 200 estado terminal já existente |

Mensagem aceita, run, reserva de orçamento e outbox são atômicos. `Idempotency-Key` tem 16–128 caracteres ASCII permitidos; a unicidade é `(owner, operação, recurso, chave)`. Hash canônico do request detecta mesma chave/corpo diferente (409). Repetição com mesmo corpo devolve IDs/resultado original; não cria novo run nem reserva. Guardar registro enquanto run/receipt puder ser consultado, com retenção mínima inicial de 7 dias; não apagar chave de ação externa pendente/incerta. Expiração de dedup de mensagem não deve ser usada para retry automático de envio antigo.

Há no máximo um run ativo por perfil Hermes no piloto; novos runs aguardam lease ou retornam erro explícito de capacidade conforme configuração. Cancelamento terminal não cria uma resposta diferente para fingir reversão de efeito. DELETE de conversa, export e retenção exigem contrato de cascata/forgetting antes da implementação; não adicionar delete irreversível por suposição.

## Memória e documentos — F06/F07

| Rota | Entrada | Saída/efeito |
|---|---|---|
| `GET /memories` | filtros de tipo/status/valid_at e paginação | versões atuais autorizadas, origem e status |
| `POST /memory-proposals` | conteúdo, tipo, origem autorizada | proposta; não confirma memória ativa |
| `POST /memory-proposals/{id}/accept` | `expected_version`, CSRF | memória aprovada + receipt |
| `PATCH /memories/{id}` | `expected_version`, conteúdo/validade | nova versão; conflito 409 |
| `DELETE /memories/{id}` | CSRF, chave de idempotência | 202 forgetting job e bloqueio imediato de retrieval |
| `POST /knowledge/uploads` | metadados declarados, quota | ticket privado expirá­vel; MIME real será verificado |
| `POST /knowledge/uploads/{id}/complete` | checksum esperado | inicia quarentena/extração; sem `ready` antecipado |
| `GET /knowledge/documents/{id}` | sessão | estado de processamento, versão, fontes e permissões |
| `GET /artifacts/{id}/download` | sessão | stream autorizado; 404 inacessível, 409 se ainda não pronto |

Formato binário do upload e geração de URLs depende do adaptador storage; fechar esse trecho em F07 sem expor path físico. Para exclusão, consultar job até receipt final e refletir “em andamento” na UI. Atualização/forgetting invalidam contexto técnico e índices conforme ADR0003.

## Aprovações — F05 mínimo/F08 completo

`GET /approvals` lista apenas do owner. `GET /approvals/{id}` retorna intenção imutável saneada: ferramenta/versão, conta rotulada, destinatário/alvo, conteúdo a enviar quando autorizado, efeito, prazo e `intent_hash`. `POST /approvals/{id}/decision` recebe `{decision:"approve"|"deny", intent_hash, expected_version}` e CSRF, com chave de idempotência. Aprovar não executa na thread HTTP: consome decisão e publica outbox após commit. A corrida aceita uma decisão; conflito/expiração não renova autoridade.

Request não pode alterar argumentos, usuário, connection ou ferramenta. Tokens secretos de aprovação não entram em URL nem no modelo. Browser apresenta conteúdo externo como texto, não como HTML ativo. Mandato recorrente é entidade própria e não inferido de uma decisão individual.

## Gate de integração

O schema executável e OpenAPI são gerados/testados a partir de `packages/contracts`; este documento é intenção de produto. CI deve verificar respostas/erros/eventos contra schemas e detectar drift de rotas implementadas. Alteração aditiva compatível usa v1; campo removido/tipo semântico alterado exige versão/migração. Segredos/mensagens privadas não aparecem em exemplos OpenAPI. Fixtures são sintéticas e identificadas como tal.
