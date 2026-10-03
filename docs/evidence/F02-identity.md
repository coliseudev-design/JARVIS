# Evidência F02 — núcleo de identidade

Implementação: 02/10/2026. Validação final: 03/10/2026. Ambiente cloud nativo Debian13, Node24.19.0, PostgreSQL17.11/pgvector0.8.0, Redis8.0.2 e Chromium. Fixtures sintéticas; nenhum usuário real foi criado. A validação Docker adicional está em `F02-containers.md`; VPS não foi homologada.

## Implementação

Migration0002 append-only, role auth separada, Argon2id, convites de uso único, sessões opacas/CSRF/Origin, recuperação, TOTP criptografado, RLS FORCE do perfil e UI de ações reais. Veja ADR0007 e `docs/runbooks/coolify.md` para limites e operação.

## Verificações executadas

- `npm run check`: build dos seis workspaces, typecheck e 8 testes unitários/contrato, incluindo vetores RFC6238, senha e autenticação do ciphertext/AAD.
- `bash scripts/with-dev-env.sh npm run test:integration`: 3 testes de fundação e 11 testes de identidade em PostgreSQL descartável. Incluem R/M no mesmo tenant, outro tenant, admin, contexto vazio, INSERT WITH CHECK, ownership não atualizável, pool=1 após erro/timeout, convites concorrentes, expiração/revogação, CSRF/Origin, recuperação e MFA/replay.
- `npm run test:browser`: repete bootstrap/migrations e testes de identidade no banco descartável; Chromium com dois contextos independentes confirma convite, login, atualização persistida do perfil, IDOR404, logout401, cookies e ausência de overflow em 1440×900 e390×844. Screenshots sintéticos locais em `.local/evidence/` são ignorados pelo Git.
- Bootstrap/provision e migrations repetidos em banco vazio; upgrade do banco de desenvolvimento schema1→2 sem apagar volume. Migration0001 preservada por checksum.
- Compose validado sem exibir valores; serviços nativos reiniciados com schema2, HTTP/readiness e probe fila→worker→PostgreSQL.

## Revisão e correções

A01 fez revisão estática independente. Dois tokens de recuperação simultâneos podiam produzir deadlock; a ordem de locks agora é usuário→token. O teste força ambos a esperar pelo mesmo usuário e exige uma resposta204 e outra400. O limitador também deixou de tratar IP do proxy como IP pessoal: limite por conta/token e circuito global do piloto são explícitos.

A validação visual encontrou e corrigiu label de senha sem nome acessível exato e estado de convite residual após logout. Argon2id foi medido em cinco pares hash+verify,259–286ms no host; sem extrapolação de carga ou VPS.

## Limites não testados ou não implementados

Build Docker e execução local passaram após corrigir confiança na CA do proxy; ver `F02-containers.md`. CI remoto inacessível pela API, domínio/HTTPS real e Coolify não executados. Secure cookie verificado no teste API configurado para HTTPS; navegador desta sessão usou HTTP local. Mailbox privada não envia e-mail. Recuperação de MFA perdido, múltiplos workspaces na UI, gestão completa de memberships, retenção automática e edge rate limiting ainda pendentes. Respostas genéricas não constituem prova de indistinguibilidade temporal de contas.

Arquivos, SSE/chat, memória, jobs pessoais e providers live não existem neste slice; seus gates não foram considerados aprovados. Perfis canário comprovam somente os caminhos exercitados. RLS confia no backend que define o contexto, não resiste a execução arbitrária no processo API.
