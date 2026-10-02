# ADR 0004 — Broker, intenção imutável e reconciliação

Data: 2026-10-02. Estado: decisão aceita; execução do produto depende de F05/F08. Responsáveis: A01/A08/A02.

## Decisão

Todas as ferramentas do runtime entram por um broker autorizado. O catálogo tem versão/schema, classe de efeito, capabilities, timeout, escopos de dados, política de retry e semântica de receipt. Não habilitar terminal/browser/cron genéricos Hermes no piloto. Um prompt, skill, documento ou “agente de segurança” não concede autorização. O runtime recebe apenas subconjunto de ferramentas permitido para o run.

Classes de efeito: leitura; escrita local reversível; comunicação/mutação externa; destrutiva/financeira/administrativa. Leitura ainda exige grants e limites; chamar browser “read-only” não torna cliques/formulários leitura. Mutações externas precisam de aprovação concreta ou mandato recorrente persistido cobrindo precisamente alvo, conta, tipos de efeito, duração e orçamento. Produção e shell irrestrito ficam desabilitados no produto inicial.

## Protocolo obrigatório

1. Validar schema estrito, connection ownership, ferramenta/versão e escopo. Canonicalizar argumentos conforme JSON Canonicalization Scheme (RFC 8785) ou implementação compatível testada; rejeitar números/encodings não suportados.
2. Persistir `tool_call`, intenção com argumentos imutáveis, hash, alvo e efeito previstos. Segredos são referências privadas resolvidas só no executor; não participam do payload público.
3. Avaliar policy versionada. Se exigir humano, criar aprovação vinculada ao mesmo owner/tenant/run/tool/version/connection/hash/deadline. UI obtém preview saneado do servidor.
4. Consumir decisão de uso único em transação compare-and-set; registrar outbox. Token/nonce de aprovação não é enviado ao LLM. Texto “aprovado” nunca executa essa operação.
5. Worker obtém lease/fencing e revalida sessão/mandato conforme o tipo de run, grants, versão, revoke, budget e deadline no instante de executar. Pedido alterado ou autoridade revogada não herda aprovação.
6. Persistir receipt com status `succeeded`, `failed`, `unknown` ou `not_executed`, referência externa quando existente, evidence refs e correlação. Não guardar corpo sensível na auditoria por padrão.

Resultado externo pode acontecer antes de receipt local. Timeout após envio vira `unknown` e reconciliação por chave/consulta externa; não retry cego. Um provedor sem idempotência e sem consulta confiável exige intervenção para resolver incerteza. Exactly-once externo não é garantido pelo broker, fila ou Temporal.

Cancelamento interrompe próximos passos e solicita interrupção do que está ativo. Não apaga efeito confirmado. Aprovação recusada/expirada encerra o caminho correspondente com razão explícita; não tentar outra ferramenta para contornar a recusa.

## Skills e MCP

Reutilizar protocolo MCP e bibliotecas avaliadas; desenvolver gateway de scopes/policy. Importação de skill é revisão de origem, licença, checksum, instruções/código, permissões e testes. Versão ativada é imutável; atualização não ganha grants implicitamente. Skills de código arbitrário são indisponíveis no piloto.

MCP remoto usa allowlist, valida URL/DNS/redirects e credencial scoped; stdio exige sandbox isolado. Não passar token de usuário a servidor arbitrário. Integração não pode navegar localhost, metadata ou redes privadas sem destino cadastrado explicitamente. Revogação invalida futuras chamadas e caches de autorização.

## Aceite e alternativa

Comparar duas aprovações concorrentes, destinatário/conteúdo alterado, aprovação expirada, revoke durante espera, retry de webhook e falha imediatamente após efeito externo. O canário privado não pode surgir em argumentos de outro usuário. Um único receipt confirmado deve corresponder ao efeito; incerteza aparece na UI. Alternativa de permitir ferramentas diretamente no Hermes é recusada porque pula identidade, aprovações e ledger centrais.

Fontes: [MCP security](https://modelcontextprotocol.io/specification/latest/basic/security_best_practices), [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785), [BullMQ idempotency](https://docs.bullmq.io/patterns/idempotent-jobs). Referências de projeto; não alegam conformidade implementada.
