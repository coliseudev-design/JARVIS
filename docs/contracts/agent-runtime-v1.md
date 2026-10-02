# AgentRuntime v1 — contrato interno e fronteira Hermes

Estado: alvo F00/F05, não SDK upstream implementado. Responsáveis: A01/A06/A03. Pin, licença, endpoints descobertos e resultados do spike pertencem ao ADR Hermes e à evidência de A06; o contrato abaixo não implica suporte nativo a todas as operações.

## Princípios

A aplicação controla identidade, orçamento, contexto autorizado, ferramentas e estado durável. Hermes controla execução do modelo dentro de um perfil privado. Adaptador traduz diferenças; não importa internals Python privados para API pública. Cada `(tenant, owner_user, agent)` tem um perfil/home opaco exclusivo. Um processo dono do home e um run ativo por perfil no piloto; arquivo de lock sozinho não substitui lease/fencing do supervisor.

`AuthorizationContext` é criado somente após validação de sessão/job. Runtime não recebe credencial SQL, secret nativo de provedor salvo em config, docker.sock ou filesystem de outro perfil. Transporte privado autenticado com prazo/audience, endpoints allowlisted e nenhum bearer entregue à web. Callback upstream também precisa de autenticação e mapeamento de run, não basta conhecer um UUID.

## Interface de referência

Tipos abaixo documentam semântica, não código a importar. Schemas executáveis viverão em `packages/contracts` quando implementados.

```ts
type RuntimeCapability =
  | 'text_stream' | 'run_inspect' | 'cancel_request'
  | 'tool_gate' | 'session_continuity' | 'model_selection';

type CapabilityStatus = 'verified' | 'unsupported' | 'unverified';

type RuntimeDescriptor = {
  adapter_version: string;
  upstream_commit: string;
  capabilities: Record<RuntimeCapability, CapabilityStatus>;
  // Verification describes a pinned build and test environment, not all providers.
  evidence_refs: string[];
};

type ExecutionScope = {
  tenant_id: string;
  owner_user_id: string;
  agent_id: string;
  run_id: string;
  authorization_revision: string;
  lease_fencing_token: string;
};

type RuntimeRunRequest = {
  scope: ExecutionScope;                     // never client supplied
  runtime_profile_id: string;                 // resolved on server
  runtime_session_id?: string;                // resolved from conversation mapping
  conversation_id: string;
  application_message_id: string;
  input: Array<
    | { type: 'text'; text: string }
    | { type: 'image_ref'; authorized_object_ref: string }
    | { type: 'source_excerpt'; source_id: string; version: string; text: string }
  >;
  context: { persona_version: string; memory_revision: string };
  model: { provider: string; model_id: string; policy_version: string };
  tool_capabilities: Array<{ name: string; version: string; grant_ref: string }>;
  limits: { deadline: string; max_output_tokens: number; budget_reservation_id: string };
  idempotency_key: string;
};

type RuntimeHandle = {
  run_id: string;
  runtime_run_id: string;                     // stored privately, never authority
  runtime_session_id?: string;
};

type RuntimeOutcome = {
  status: 'running' | 'waiting_tool' | 'completed' | 'failed' | 'interrupted' | 'unknown';
  served_provider?: string;
  served_model?: string;
  served_model_status: 'verified' | 'reported' | 'unknown';
  usage_status: 'actual' | 'estimated' | 'unknown';
  usage?: { input_tokens?: number; output_tokens?: number };
};

interface AgentRuntime {
  describe(): Promise<RuntimeDescriptor>;
  start(request: RuntimeRunRequest): Promise<RuntimeHandle>;
  events(handle: RuntimeHandle, cursor?: string): AsyncIterable<RuntimeFrame>;
  inspect(handle: RuntimeHandle): Promise<RuntimeOutcome>;
  cancel(handle: RuntimeHandle): Promise<{ accepted: boolean; terminal: boolean }>;
  resumeTool(handle: RuntimeHandle, result: AuthorizedToolResult): Promise<void>;
  reconcile(handle: RuntimeHandle): Promise<RuntimeOutcome>;
}
```

`RuntimeFrame` é união validada de delta textual, fim de mensagem, proposta de tool, usage, erro e estado, com upstream cursor opcional. Não encaminhar frame upstream cru à web. `AuthorizedToolResult` vem do broker, contém `tool_call_id`, receipt/result autorizado e versão da decisão; não aceita o modelo como autor de aprovação. Se não houver `tool_gate` comprovado, `resumeTool` retorna `CAPABILITY_UNAVAILABLE` e a ferramenta não é anunciada ao runtime.

`describe` separa suportado de verificado. Ausência de capability não vira sucesso vazio. `start` deve recusar provider/model/parameter incompatíveis, dados sem permissão ou lease vencido antes do envio. `cancel.accepted=true` só confirma pedido recebido; terminal precisa de observação posterior. `reconcile` pode retornar `unknown` e bloquear repetição; não “reinicia para ver se funciona”.

## Mapeamento e idempotência

`run_id` da aplicação é estável e único; upstream IDs são armazenados numa tabela privada com scope e constraints. Contexto autenticado é derivado da relação persistida, nunca do callback/browser. A chave de start e fingerprint do input ficam no banco antes da chamada; adaptador faz claim com lease. Se upstream não suporta idempotência e o envio falha após aceitação possível, inspecionar/reconciliar; sem descoberta confiável de run, marcar `unknown`, sem repetir.

Histórico da aplicação é canônico para UI. Continuidade técnica Hermes só é reutilizada para o mesmo dono/agente/conversa com persona/memory revisions compatíveis. Renovação de contexto cria outra sessão técnica mantendo a conversa visual. Memory delete/revoke impede que sessão antiga recoloque fato esquecido.

Arquivos não-imagem não são enviados como `file_id` presumido: aplicação extrai trechos autorizados com referências. Imagem só entra se capability/model permitirem; URL assinada temporária ou bytes são resolvidos pelo adaptador sem vazar path/credenciais. Model requested e served são campos distintos; suporte “OpenAI compatible” não garante selecionar o modelo solicitado. Ausência de identidade do modelo servido aparece como `unknown`, não como requested copiado.

Gateway de modelo usa token efêmero scoped ao run e resolve segredo fora do home. Compatibilidade com streaming, tool messages, imagens, usage e cancelamento é gate F04/F05. Injeção direta de key no processo só poderá ser exceção em ADR posterior com teste de ausência de persistência/leak. Fixture local não comprova esse caminho live.

## Ferramentas e falhas

Tools nativas de terminal/browser/cron/integrations/memória redundante ficam indisponíveis por configuração verificada e restrição de rede/arquivos. O processo não instala skill automaticamente por saída do modelo. API upstream de approval é detalhe de transporte: broker precisa persistir intenção e validar decisão antes de permitir continuação; aprovação upstream sozinha não é autoridade do produto.

Tool output/documento é conteúdo não confiável; limite tamanho e retorne refs autorizadas. Worker interrompido não libera lease para repetir efeito sem consultar receipts. Run cancelado pode conter efeito anterior confirmado e deve exibi-lo. Falha de provider não muda de chave/dono; fallback preserva capacidades/política e continua de estado persistido, sem reproduzir side effect.

## Gates concretos de A06

| Cenário | Evidência exigida | O que fixture local não prova |
|---|---|---|
| Dois perfis R/M | Homes/workspaces/config/transcript disjuntos; canários alternados e simultâneos | Isolamento sob carga/VPS e contenção hostil completa |
| Modelo | Pedido explícito e modelo servido registrado; rejeitar combinações inválidas | Suporte/custo real de fornecedor não conectado |
| Streaming/reconnect | Eventos traduzidos em ordem, final consistente, cursor reaproveitável | Rede de produção/proxy TLS |
| Cancelamento | Resposta lenta interrompida; estado e efeitos anteriores registrados | Reversão de efeito externo |
| Reinício | Queda, lease vencido, reconciliação sem duplicate start | Durabilidade se estado só existir em memória |
| Ferramentas | Nenhum terminal/browser/cron fora do broker; prompt injection não contorna | Restrição apenas por instrução textual |
| Memória | Flags e teste de ausência de leitura/escrita redundante; nova sessão após invalidar contexto | Exclusão em backups/projeções ainda não implementados |

F00 pode ficar parcialmente validada com fixture marcada. F05 live continua bloqueada se isolamento ou ferramenta não puderem ser contidos, mesmo que chat básico funcione. APIs descobertas no upstream não são automaticamente rotas públicas da aplicação.
