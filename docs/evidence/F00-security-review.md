# F00 — revisão de segurança A02/A14

Data: 02/10/2026. Estado: planejamento de segurança entregue; controles ainda não implementados. Ambiente: checkout `/workspace/JARVIS`, árvore inicial sem commit de implementação no momento da revisão.

## Material lido e entrega

Leitura integral de `AGENTS.md`, `PLANO_COMPLETO_IRONMAN_JARVIS.md` (855 linhas) e `docs/PESQUISA_TECNOLOGICA.md` (116 linhas). Não houve execução de testes de autenticação, RLS, integração live ou invasão de serviços externos nesta entrega.

- [Modelo de ameaças](../security/THREAT_MODEL.md): ativos, fronteiras, 17 ameaças, gates e divergências do plano.
- [Matriz de permissões](../security/PERMISSION_MATRIX.md): operação × papel/worker, ownership, ACL, revogação e erros.
- [RLS e pooling](../security/RLS_AND_POOLING.md): roles, políticas por comando, transação, constraints, bootstrap auth/jobs e limites.
- [Suíte negativa proposta](../security/NEGATIVE_TEST_PLAN.md): 20 grupos de cenários R/M no mesmo tenant, tenants distintos e papel admin, com controles positivos.

## Achados que orientam implementação

1. RLS sem testar role/ownership reais pode produzir falsa garantia. F02 exige PostgreSQL real, role sem bypass/ownership, WITH CHECK e teste de pool.
2. Discovery de outbox e lookup pré-login são operações privilegiadas diferentes de acesso pessoal. Não resolver com BYPASSRLS no worker/API.
3. Cursor SSE e object key não são autorização; revogar sessão/conexão/ACL precisa cortar streams e usos pendentes.
4. RLS não cobre filesystem, homes Hermes, gateway de modelos ou credenciais. A06 precisa comprovar dois homes/toolset e A05 precisa teste de fallback sem chave alheia.
5. Admin operacional não possui conteúdo. Suporte com impersonation permanece indisponível até grant específico projetado.
6. Worker restaurado, rotina e sessão web têm ciclos de autoridade diferentes; mandato recorrente é explícito e revogável.

F00 de segurança documental concluída. F00 geral e F01/F02 só podem ser declaradas concluídas pelo coordenador mediante evidências próprias. Esta entrega não remove gates do spike Hermes nem dos testes de isolamento.

## Revisão cruzada

Pendente no momento da primeira escrita: A01 (ADRs/contratos) e A06 (spike Hermes) ainda em produção. Registrar revisão e eventuais achados abaixo quando os arquivos estiverem disponíveis.

### Integração A00/A01

ADRs/contratos revisados por A01 contra os documentos A02. Mesmo tenant não compartilha conteúdo; auth/outbox discovery têm acesso privilegiado mínimo distinto de API/worker. Revisão do spike delimitou isolamento lógico versus sandbox hostil e ausência de replay/crash em run ativo. XDG state foi separado por home e os doze checks repetidos. A fundação F01 mantém produto sem autenticação/execução privada e testa roles mínimas no PostgreSQL real; isso não conclui a suíte pessoal/RLS F02.
