# Contrato de eventos e estado durável v1

Estado: alvo F05; F01 pode validar o envelope sem executar Hermes. Responsáveis: A03 (persistência/SSE), A06 (tradução upstream), A04 (consumo).

## Envelope e entrega

```json
{
  "event_id":"00000000-0000-4000-8000-000000000011",
  "sequence":"1",
  "schema_version":1,
  "conversation_id":"00000000-0000-4000-8000-000000000012",
  "run_id":"00000000-0000-4000-8000-000000000013",
  "occurred_at":"2026-10-02T12:00:00.000Z",
  "type":"run.queued",
  "payload":{"state":"queued"}
}
```

Exemplo sintético. `sequence` é inteiro positivo em string decimal (seguro além de JS MAX_SAFE_INTEGER), monotônico e único por run. Comparar numericamente, não lexicograficamente. `event_id` é globalmente único. Sequência é atribuída na transação que persiste evento e versão do run. Lacunas por rollback podem existir; cursor autoriza reprodução, não preenchimento por dados inventados. `occurred_at` é horário do servidor, nunca ordenação primária.

SSE usa `id: <event_id>`, `event: <type>`, `data: <JSON do envelope>` e linha em branco. `Last-Event-ID` é resolvido dentro do run e do owner autorizados; cursor de outro run não troca escopo. Revalidar sessão/revogação periodicamente e ao publicar; encerrar stream revogado, sem enviar mais conteúdo. Use subscription do owner, não broadcast global filtrado no cliente.

Entrega é pelo menos uma vez: cliente deduplica por `event_id` e aplica eventos por sequência. Cursor desconhecido/expirado retorna erro 410 antes dos headers SSE; cliente consulta snapshot autorizado de mensagens/run e abre stream novo. Reconnect nunca repete POST de mensagem. Heartbeats são comentários SSE, sem IDs nem progresso fictício. Proxy não deve bufferizar; desconexão não cancela o run. Slow client tem buffer limitado e deve reconectar a partir de cursor, sem derrubar execução.

Persistir deltas permitidos antes de publicá-los ou agrupá-los em chunks persistidos com limites; não prometer replay de token que nunca foi gravado. Snapshot final contém texto completo e versão. Retenção de eventos precisa cobrir runs ativos e janela de reconexão publicada; a limpeza não apaga receipts de ações incertas.

## Tipos e payloads mínimos

| Tipo | Payload público mínimo | Regra |
|---|---|---|
| `run.queued` / `run.started` | `state`; `started_at` quando aplicável | Estado durável, não timer do front |
| `assistant.delta` | `message_id`, `delta_index`, `text` | Texto de resposta permitido; nunca private reasoning |
| `assistant.completed` | `message_id`, `content_version`, `finish_reason` | Final da mensagem, não conclusão de todas as ações |
| `tool.proposed` | `tool_call_id`, `tool_name`, `tool_version`, `effect_class`, resumo seguro | Argumentos secretos removidos |
| `approval.required` | `approval_id`, `tool_call_id`, `expires_at` | UI carrega preview autorizado via API |
| `tool.started` | `tool_call_id` | Executor adquiriu lease/policy válida |
| `tool.completed` | `tool_call_id`, `receipt_id`, `outcome` | `succeeded`, `failed`, `unknown` ou `not_executed`; não pressupor sucesso |
| `memory.proposed` | `proposal_id`, resumo autorizado | Não significa gravado/aprovado |
| `artifact.ready` | `artifact_id`, `media_type`, `size_bytes` | Objeto existe, validado, com download autorizado |
| `voice.state` | `state`, `voice_session_id` | Somente F10; identidade derivada de vínculo validado |
| `run.awaiting_approval` / `run.cancelling` / `run.reconciling` | `state`, referência segura quando aplicável | Transições explícitas de controle |
| `run.completed` | `state`, `usage_status` | Todos os passos requeridos resolvidos; uso pode continuar estimado |
| `run.failed` | `state`, `error_code`, `retryable` | Erro saneado; incerteza externa não dispara retry cego |
| `run.cancelled` | `state`, `reason`, `effects_may_have_completed` | Não representa rollback |
| `run.interrupted` | `state`, `reason` | Lease/worker perdido; exige reconciliação |

`run.completed` e os tipos de transição estendem a lista exemplificativa do plano para evitar inferir término pelo fechamento do socket. Schema discriminado por `type`, versionado, com limites de texto/tamanho e `additionalProperties:false` em cada variante. Eventos desconhecidos não alteram estado no cliente; induzem refresh compatível. Não colocar transcript completo em audit log operacional.

## Máquina de estados e concorrência

- `queued → running | cancelled | failed`.
- `running → awaiting_approval | completed | failed | cancelling | interrupted`.
- `awaiting_approval → running | cancelled | interrupted`; expiração/recusa têm reason próprios. Revalidar política antes de `running`.
- `cancelling → cancelled | interrupted`; se efeito está incerto, interromper e reconciliar, sem declarar cancelamento concluído.
- `interrupted → reconciling`.
- `reconciling → completed | failed | queued | cancelled`; só voltar a `queued` se retomada for comprovadamente segura, e `cancelled` se nenhum efeito pendente/incerto restar.
- `completed`, `failed`, `cancelled` são terminais. Novo pedido de retry é novo run ligado ao anterior, após reconciliação das ações.

Atualizações usam `(run_id, version, lease_fencing_token)` em compare-and-set. Heartbeat perdido invalida lease; worker antigo não publica estado nem executa próximo efeito. Receipts e decisões de aprovação têm unicidade própria. Terminal só é persistido após resolver efeitos conhecidos; `failed` pode conter receipt `unknown` explicitamente para intervenção, jamais ser reexecutado automaticamente.

Contagem de subtarefas aparece apenas quando plano congelado fornece denominador. “2 de 3 concluídas” não vira percentagem do tempo restante. Fonte, agente e tool clickables referenciam recursos autorizados. Não expor pensamento interno, raw tool arguments ou provider frames sem transformação.

## Testes que verificam o contrato

Conexão cai depois do commit e antes da entrega; cliente recebe cada efeito visual uma vez ao reconectar. Dois workers tentam publicar terminal; só lease vigente consegue. Cursor de M em R falha sem evento privado. Sessão revogada encerra stream. Cancelamento durante ferramenta registra efeito já confirmado ou desconhecido. Delta e snapshot final coincidem. Evento fora da ordem é tolerado sem inventar texto; cursor expirado usa snapshot sem reenvio do prompt.
