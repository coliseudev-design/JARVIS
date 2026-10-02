# Estado do JARVIS

Atualizado em 02/10/2026. Fonte de escopo: plano original F00–F20. Esta entrega inaugura o repositório, previamente vazio. Evidências referem-se à máquina cloud desta sessão, não à VPS do usuário.

Código e Compose publicados na branch `main` de `coliseudev-design/JARVIS`; publicação inicial `136227e`. Clone limpo instalou e passou os checks. Configuração cloud `install_script`/`start_skill` salva; publicação do snapshot depende do fluxo do produto. GitHub API impediu consultar o resultado do CI remoto, portanto ele segue não confirmado.

| Marco | Estado real | Evidência / próximo gate |
|---|---|---|
| Planejamento F00–F20 | Entregue | `IMPLEMENTATION_PLAN.md`, 15 prompts A00–A14, ExecPlans F00/F01 |
| F00 arquitetura/segurança | Entregue e revisada | 6 ADRs, contratos API/eventos/runtime, threat model, matriz de permissões, plano negativo e storyboard |
| F00 spike Hermes | Validado localmente com provider sintético | 12 checks, upstream real fixado, dois homes e XDG state independentes; `evidence/F00-hermes.md` |
| F01 fundação | Implementada e validada nativamente | Build, typecheck, 5 testes unitários/contrato + 3 integrações, banco vazio, repetição e HTTP reais |
| F01 Compose/CI | Configuração preparada; containers ainda não homologados | Schema Compose e bootstrap SQL passaram; Docker Hub 429 impede build local; CI ainda precisa execução no GitHub |
| F02 identidade | Próxima fase, não iniciada | Sessões/convites/MFA/CSRF/RLS e testes canário reais de pessoa |
| F03–F06 MVP pessoal | Planejadas | UI completa, cofre/modelos, chat Hermes integrado, perfil/memória com esquecer |
| F07–F15 V1 | Planejadas | Documentos, tools, Google, voz, browser, Telegram, rotinas, auditoria e homologação |
| F16–F20 avançadas | Planejadas, preservadas | Temporal/missões, memória temporal, multimodal, companion e escala |

## Comportamento disponível agora

Web PT-BR consulta capabilities reais e apresenta falha de conexão. API publica liveness, readiness e status/OpenAPI. Readiness exige schema 1, extensão vector, role sem superuser/BYPASSRLS/ownership e Redis acessível. Worker aceita exclusivamente probes sintéticos estritos, registra no PostgreSQL e recusa campos de identidade arbitrários. Nenhum endpoint executa ação pessoal ou externa.

Bootstrap cria roles separadas para API, worker e migration. Essa fundação **não implementa RLS de conteúdo pessoal nem autenticação**: tabelas do produto serão criadas na F02. O worker F01 não executa tarefas dos usuários. A UI não tem login/chat fictícios.

## Execução por agentes

A00 coordenou; A01 entregou arquitetura/contratos/storyboard; A02 entregou segurança; A06 implementou o spike. A02/A06 atingiram o limite de execução dos agentes após entregas parciais. A00 assumiu documentação restante, repetiu o spike, corrigiu XDG state e integrou a fundação sequencialmente. Revisão A01 explicitou limites do experimento. Nenhum arquivo foi descartado por conflito entre autores.

## Pendências concretas

- Provar build/startup Docker e deploy Coolify quando houver acesso ao registry. Tags estão fixadas, digests e patch exato da imagem PostgreSQL ainda não foram homologados.
- F05: provider live, sandbox de processo/egress, broker, replay SSE de runs e queda durante execução; fixture F00 não prova esses itens.
- VPS/domínio/região/recursos/orçamento, Google/Telegram/voz e hardware Mac não foram configurados nesta sessão. Integrações live dependem dos ambientes/contas apropriados.
- Vídeos não foram anexados; storyboard deriva das descrições do plano, sem alegar análise visual direta dos MP4s.
- Nada foi publicado na VPS ou homologado em staging. Publicação do código no GitHub é distinta de deploy ou publicação de snapshot cloud.

## Próximo slice

F02: definir schema de identidade/ownership, criar convite/login/sessões/CSRF, usar role real e testar R/M no mesmo tenant, tenants distintos, revogação e pool tamanho 1. Manter execução externa e dados pessoais indisponíveis até os gates passarem. O Compose evolui com as fases; ele não implica conclusão antecipada do produto.
