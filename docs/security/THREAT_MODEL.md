# Modelo de ameaças inicial — F00

Status: desenho revisável para implementação. Não comprova controles implementados. Base: plano completo §§5–14, pesquisa tecnológica e AGENTS.md, lidos integralmente em 02/10/2026. Responsáveis: A02/A14; decisões de arquitetura compartilhadas com A01/A00.

## Ativos, adversários e fronteiras

Ativos: sessões, fatores MFA, convites/recuperação, credenciais de fornecedores, conteúdo pessoal, documentos, memória, homes Hermes, conexões externas, aprovações, orçamento, receipts e backup. R e M são identidades sintéticas; nenhuma informação pessoal real compõe fixtures.

Adversários considerados: visitante, membro malicioso do mesmo tenant, membro de outro tenant, administrador operacional curioso, página/documento/skill com prompt injection, serviço externo comprometido, runtime comprometido e consumidor de fila forjado. Operador root da VPS tem acesso técnico aos processos e chaves; não se promete E2EE contra ele. Sua redução de risco depende de acesso operacional mínimo, custódia e auditoria externa.

Fronteiras a testar separadamente:

1. Navegador/canal → API: sessão opaca, CSRF/Origin, payload validado, identidade derivada no servidor.
2. API/worker → PostgreSQL: transação com escopo, role limitada, RLS e constraints.
3. API → SSE/storage/cache: autorização de cada recurso; IDs e prefixos não são capabilities.
4. Outbox → Redis → worker: referência a trabalho persistido e revalidação; Redis não determina identidade.
5. Worker → Hermes: profile resolvido pelo servidor, lease exclusivo, volume e credencial por perfil.
6. Hermes → modelos/broker: capacidades mínimas por run, nenhum segredo nativo no contexto; broker decide ação.
7. Broker → fornecedor/browser/MCP: endpoint aprovado, egress, intenção imutável, autorização e recibo.
8. Operação → backup/restauração: custódia separada, revogações/tombstones atuais antes de liberar execução.

## Ameaças priorizadas e evidência exigida

| ID | Ameaça / consequência | Controle obrigatório | Verificação e fase |
|---|---|---|---|
| T01 | IDOR em IDs, filtros, relações ou batch expõe R a M | Ownership + tenant em toda consulta, constraints compostas, erro privado uniforme | N01–N05 em PostgreSQL/API reais, F02 |
| T02 | Pool reutiliza contexto R para M | Contexto exclusivamente transacional na mesma conexão; ausência nega | N06 em pool de tamanho 1, rollback/timeout/cancelamento, F02 |
| T03 | Admin concede a si acesso a conteúdo | Administração separada de grants de conteúdo; sem bypass por role | N03, F02; suporte explícito somente quando implementado |
| T04 | Roubo/reuso de sessão ou recuperação | Cookie HttpOnly/Secure/SameSite, hash de token, prazo/revogação, MFA admin, uso único atômico | N07, F02; MFA gate antes de acesso público |
| T05 | SSE/cursor ou download revela conteúdo após revogação | Assinatura vinculada à sessão/run; revalidação e encerramento; download via API privada no piloto | N08–N09, F02/F05 |
| T06 | Job forjado ou restaurado atua como outro usuário | Carregar referência persistida, mandato/current membership/conexão, lease/fencing e estado | N10, F02/F05/F13 |
| T07 | Prompt injection manda exfiltrar/aprovar | Documentos e modelos não são autoridades; ferramentas allowlist + broker | N11, F05/F08 |
| T08 | Aprovação reutilizada ou argumentos mudados geram efeito indevido | Intenção canônica imutável, versão/hash/alvo, consumo atômico, revalidação e receipt | N12, F08 |
| T09 | Retry/fallback duplica email/compra | Idempotência por ação; reconciliação quando resultado incerto; sem retry cego | N12, F08/F09 |
| T10 | Segredo vaza em prompt/log/trace/erro/export/home | Cofre AEAD, key version, AAD scoped, write-only; gateway de modelos e redação allowlist | N13, F04/F05 |
| T11 | SSRF alcança metadata/localhost/Coolify | Validação DNS/IP/redirect por salto e egress de execução; não aceitar destinos livres | N14, F04/F08/F11 |
| T12 | Homes/leases/browsers misturam usuários | Containers/homes por usuário+agente; lease/fencing; cookies/workspace independentes | N15, spike F00/F05/F11 |
| T13 | Arquivo atravessa diretório, executa código ou esgota recursos | Quarentena, limites expandidos, recusa de symlink/traversal, parser isolado, MIME validado | N16, F07 |
| T14 | Apagar memória não remove projeção/cache/backup restaurado | Tombstones atuais, invalidar índices/contexto, restauração pausada e reconciliada | N17, F06/F15 |
| T15 | Concorrência ultrapassa orçamento ou quotas | Reservas atômicas, limites por dono/tenant, timeout/backpressure | N18, F04/F14 |
| T16 | Canal/dispositivo/voz troca identidade | Pareamento de uso único, ID estável, revogação; áudio não é autenticação | N19, F10/F12/F19 |
| T17 | UI/observabilidade mostra fonte privada ou executa conteúdo | Renderização segura, schemas, CSP apropriada, telemetria sem bodies por padrão | N20, F03/F14/F18 |

Falha de isolamento T01–T06/T10/T12 bloqueia disponibilização multiusuário. Falhas de efeitos externos T07–T09 bloqueiam a ferramenta. Ferramenta que não admite contenção verificável fica desabilitada. Documentação não satisfaz esses gates.

## Gates de implementação

| Gate | Pré-condição verificável | Sem pré-condição |
|---|---|---|
| G-identity, F02 | Sessão validada, membership ativa, permissão por operação, RLS e N01–N10 | Somente serviço local sem conteúdo protegido; não simular login como real |
| G-secrets, F04 | Chave mestra externa ao DB, integridade AEAD, rotação/revogação, N13 | Provedores live indisponíveis; fixtures explícitas |
| G-runtime, F00/F05 | Upstream fixado, dois homes/leases, API privada, toolset contido, N15 | Spike/adaptador em desenvolvimento; F05 bloqueada para live |
| G-broker, F05/F08 | Capabilities por run, intenção/aprovação/receipt e N11–N12 | Ferramentas sintéticas sem efeito externo |
| G-stream, F02/F05 | Autorização inicial + replay + revogação na conexão aberta | Endpoint protegido não habilitado |
| G-jobs, F02/F05 | Referência persistida, autoridade vigente, dedup/fencing e N10 | Worker sem execução de negócio |
| G-storage, F02/F07 | Metadados scoped, objeto privado, download autorizado, quarentena | Nenhum upload/download privado exposto |
| G-release, F14/F15 | Gates relevantes executados, restore isolado, TLS, MFA admin, nenhuma falha alta/crítica explorável | Sem liberação pública |

Os testes Nxx estão em [NEGATIVE_TEST_PLAN.md](NEGATIVE_TEST_PLAN.md); a política de acesso em [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md).

## Contradições, decisões e limites a resolver

| Item | Decisão inicial / encaminhamento | Dono e prazo |
|---|---|---|
| Plano menciona `.codex/agents` pronto, mas pacote entregue não demonstra compatibilidade | Usar prompts Markdown e ferramentas reais de delegação; não criar formato imaginado | A00, F00 |
| Plano sugere worktrees; setup/AGENTS manda usar checkout isolado existente | Seguir AGENTS; nenhum worktree sem pedido explícito | A00, imediato |
| F10 refere wake word/companion em F16; fase específica é F19 | Tratar wake word/background como F19; F16 apenas workflows | A00/A10, ExecPlans |
| F07 inclui coleções empresariais, F20 expande ACL/agentes compartilhados | F07: compartilhamento explícito de documento/coleção; agente compartilhado apenas F20 | A01/A07, antes schema F07 |
| Segurança de admin no produto versus poder de operador VPS | Sem conteúdo por papel de app; transparência sobre operador e custódia | A02/A13, F02/F15 |
| Logout versus automação previamente autorizada | Run interativo exige sessão/mandato vigente; rotina tem mandato próprio revogável, não cookie duradouro | A02/A12, F02/F13 |
| Home por usuário/agente versus múltiplos tenants | Mapear perfil também ao escopo tenant do agente; não reutilizar home entre memberships | A01/A06, F00/F05 |
| Presigned URLs versus revogação imediata | Piloto usa proxy de download com nova autorização; se adotar URL assinada, ADR deve explicitar janela e mitigação | A02/A13, F02/F07 |
| Memória nativa Hermes versus PostgreSQL canônico | Desabilitar redundância quando suportado; projeção só com versão/tombstone e teste real | A06/A07, F05/F06 |
| Requisitos futuros de suporte com conteúdo | Sem endpoint de impersonation/export administrativo no piloto. Futuro grant com consentimento, prazo, alvo e auditoria | A02, F20 |
| F00 depende de capacidades upstream e credenciais | Testes locais sintéticos e leitura do código separados de modelo live; não declarar integração completa | A06/A00, F00 |

A01 transforma escolhas comuns em ADR; este documento registra os limites de segurança, sem substituir contratos executáveis.
