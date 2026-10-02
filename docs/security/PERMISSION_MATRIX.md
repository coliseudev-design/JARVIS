# Matriz de autorização — proposta normativa F00/F02

Padrão: negar. Papel administrativo nunca implica ownership. `platform_admin`, `tenant_admin` e `member` abaixo descrevem papel na aplicação; credencial de migration não é um usuário. Toda concessão exige sessão válida, membership ativa, tenant selecionado validado no servidor e recurso compatível. Selecionar tenant no cliente apenas solicita contexto; não o autentica.

Legenda: **P** = apenas recurso próprio; **A** = ACL explícita vigente e operação concedida; **O** = operação administrativa sem conteúdo privado; **—** = negar. Administradores mantêm P sobre seus próprios recursos, sob os mesmos limites que member.

| Operação | Member | Tenant admin | Platform admin | Runtime/worker |
|---|---|---|---|---|
| Ler/editar perfil, persona e memória pessoal | P | P | P | Capacidade do run; memória escrita com origem/receipt |
| Criar/listar/ler/enviar/apagar conversa e mensagem | P | P | P | Run persistido e scope conferidos |
| Consultar/cancelar run e assinar/reproduzir SSE | P | P | P | Só eventos do run autorizado |
| Upload/listar/baixar/remover arquivo privado | P | P | P | Referência de arquivo deliberadamente concedida |
| Ler documento/coleção empresarial | P ou A | P ou A | P ou A | A aplicada antes de retrieval |
| Editar documento compartilhado | P ou A-write | P ou A-write | P ou A-write | Capacidade específica, nunca só ACL-read |
| Conceder/revogar ACL de coleção | P; sem transpor tenant | P, ou grant específico | P, ou grant específico | — |
| Criar/configurar agente pessoal e skills | P | P | P | Não concede permissão a si mesmo |
| Instalar skill executável arbitrária no piloto | — | — | — | — |
| Cadastrar/rotacionar/revogar segredo pessoal | P, write-only | P, write-only | P, write-only | Não recebe endpoint de leitura de segredo |
| Ler valor salvo de qualquer segredo | — | — | — | Apenas serviço de cofre dedicado resolve para fornecedor |
| Usar credencial empresarial delegada | A-use | A-use | A-use | Agent/run e policy compatíveis; sem ler chave |
| Administrar delegação de credencial empresarial | — | O se policy permitir | O se policy permitir | — |
| Conectar/revogar conta externa | P | P | P | Revalida conexão antes de cada uso |
| Propor ação externa | P + tool scope | P + tool scope | P + tool scope | Tool scope/mandato delimitado |
| Aprovar/recusar intenção | P + autoridade sobre ação/conexão | Mesmo requisito | Mesmo requisito | Nunca aprova própria ação |
| Executar intenção aprovada | Via broker | Via broker | Via broker | Só executor broker, consumo atômico |
| Criar/pausar rotina ou parear dispositivo/canal | P | P | P | Mandato revogável específico |
| Convidar/desativar membro, gerir papel de tenant | — | O no tenant; sem elevar a platform_admin | O no escopo administrativo | — |
| Gerir tenants/operação da plataforma | — | — | O | Serviço operacional dedicado |
| Ver audit/saúde/consumo agregado | P sobre seu uso | O sanitizado no tenant | O sanitizado | Publicar métricas permitidas |
| Ler chats por suporte/impersonation | — | — | — | —; feature futura exige grant próprio |
| Exportar/apagar dados pessoais | P + reautenticação quando sensível | P | P | Export job do dono; sem arquivo público |
| Migration/restore/admin banco | — | — | — | Credencial operacional offline separada |

Na F02, features futuras permanecem indisponíveis; a matriz antecipa seus contratos. ACL não deve expor dados de origem privados anexados a uma coleção por engano. Compartilhar exige ação explícita com alvo e resumo do conteúdo.

## Regras transversais por operação

- A API resolve `actor_user_id`, `tenant_id`, sessão e membership; nunca aceita `owner_user_id`, role ou runtime profile do body como autoridade. Recursos novos recebem owner no servidor. Tentativa de trocar owner/tenant em PATCH é recusada.
- Todo ID filho é verificado junto ao pai e scope: attachment↔message↔conversation, approval↔tool_call↔run, credential↔agent e event↔run. UUID imprevisível não substitui permissão.
- Recurso privado inexistente e alheio retornam o mesmo erro público, proposto `404`; sessão inválida `401`; operação administrativa conhecida sem papel `403`. Logs guardam motivo sanitizado, sem canários/conteúdo.
- Listagens, contagens, autocomplete, vetores e grafo filtram antes de retornar candidatos. Um item alheio não pode revelar nome, existência, thumbnail ou total.
- Mutação usa proteção CSRF/Origin e cookie válido; login/OAuth também validam origem/state conforme fluxo. Acesso por GET não executa efeito externo.
- Revogar sessão corta requests seguintes e streams abertos; nenhum evento de conteúdo é entregue após a validação detectar revogação. Implementação deve medir e documentar prazo máximo de invalidação. Gate piloto proposto: sinalização ativa e rechecagem antes de cada evento protegido, sem depender apenas de heartbeat.
- Revogar membership/conexão/mandato impede novas etapas de jobs e ferramentas. Efeito já enviado é reconciliado e mostrado; revogação não inventa undo.
- Administrador que desativa conta pode impedir uso, mas não ler seus dados. Rotas de auditoria usam projeção sanitizada própria, sem JOIN que devolva mensagens/segredos.
- Novo grant não reinterpreta ação antiga nem expande delegação em curso. Capabilities de filho são interseção das do pai, política atual e pedido; nunca união.

## Contextos internos separados

1. **Request:** ator autenticado, sessão, tenant/membership confirmados e correlation ID. Sem token bruto em logs.
2. **Resource authorization:** alvo, owner ou grant, operação e versão da política. Ator permanece o usuário real, inclusive ao ler coleção alheia autorizada.
3. **Execution:** run/job persistido, agent, connection, capability/mandato, deadline, budgets e lease/fencing. Worker não impersona o owner informado pela fila.
4. **Audit:** ator humano/serviço, operação, alvo opaco, decisão, versão e horário. Conteúdo é omitido por padrão.

O contrato comum fica sob A01; estes campos são requisitos, não uma segunda definição de schema.
