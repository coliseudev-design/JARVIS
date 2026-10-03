# Instalar o piloto JARVIS no Coolify

Entrega F01 + núcleo F02: web, API, worker sintético, PostgreSQL/pgvector, Redis, login por convite, perfil privado, sessões e MFA. Chat Hermes integrado, memória e conexões ainda não estão disponíveis. Convites e recuperação usam **mailbox local de testes, sem SMTP**. O spike Hermes é separado deste Compose.

## Configuração do recurso

1. Crie uma aplicação do repositório `coliseudev-design/JARVIS`, branch `main`, usando **Docker Compose**.
2. Diretório base `/`, arquivo `/compose.yaml`, `Dockerfile` da raiz.
3. Configure os sete segredos abaixo no ambiente seguro do recurso. Gere cada valor separadamente com `openssl rand -hex 32`. Não publique os valores nem o `.env` preenchido.
4. Atribua domínio HTTPS **somente a `web`, porta interna 8080**. Configure `PUBLIC_ORIGIN` com essa origem exata, por exemplo `https://jarvis.example.com`, sem barra final. Verifique a integração de rede do proxy na sua versão do Coolify. Demais serviços permanecem privados.
5. Faça deploy: PostgreSQL saudável → `provision` → `migrate` → API saudável → worker/web. Redis também precisa estar saudável. Os jobs `provision` e `migrate` encerram com código 0.

| Variável | Uso |
|---|---|
| `POSTGRES_PASSWORD` | Administração do banco, usada por postgres/provision |
| `JARVIS_API_PASSWORD` | Role de conteúdo, sujeita a RLS |
| `JARVIS_WORKER_PASSWORD` | Role do worker sintético |
| `JARVIS_MIGRATOR_PASSWORD` | Role que assume owner somente para migrations |
| `JARVIS_AUTH_PASSWORD` | Role de identidade; não lê perfis pessoais |
| `REDIS_PASSWORD` | Autenticação da fila interna |
| `APP_ENCRYPTION_KEY` | Chave de 256 bits para seeds MFA e derivação CSRF |
| `PUBLIC_ORIGIN` | Origem HTTPS pública, não é segredo |

Use 64 caracteres hexadecimais nos sete segredos. O template `.env.coolify.example` contém somente nomes. Guarde `APP_ENCRYPTION_KEY` em backup seguro separado; perder ou trocar essa chave invalida seeds MFA existentes. Rotação com recriptografia ainda não está implementada.

## Primeiro operador e convites

No terminal privado do serviço **api**, execute, substituindo pelo e-mail do operador:

```bash
node scripts/bootstrap-operator.mjs operador@example.com "Meu workspace"
```

O comando cria tenant e convite de administrador, e informa apenas o caminho de um arquivo privado em `/app/.private/mailbox`. Abra esse arquivo no terminal privado e acesse o campo `link` no navegador; ele é um token temporário de uso único. Não publique seu conteúdo em logs, tickets ou chat. Cadastre nome e senha. A criação inicial fecha quando existir o primeiro usuário.

Em desenvolvimento local, prefixe esse mesmo comando com `bash scripts/with-dev-env.sh`; o caminho será dentro de `.local/`. O setup não cria uma conta real automaticamente.

Depois de entrar, ative o segundo fator na seção de segurança: confirme sua senha, adicione o segredo ao autenticador TOTP e confirme um código. Outros logins anteriores são revogados. Só então os convites administrativos ficam disponíveis. Os arquivos dos novos convites e recuperações continuam na mailbox privada, para distribuição manual por um operador confiável. Apague os arquivos consumidos/expirados; eles não são enviados por e-mail. Não há endpoint público para ler a mailbox.

O piloto aceita novos usuários por convite, com um workspace inicial por conta. Seleção de vários workspaces, gestão completa de memberships e recuperação de MFA perdido ainda não têm fluxo implementado. Recuperação de senha exige TOTP quando MFA estiver ativo; não há bypass por e-mail. Guarde acesso ao autenticador antes de depender desta instalação.

## Aceite da instalação

A página deve oferecer login e informar as capacidades reais. `GET /health/ready` retorna 200 e `{"status":"ready"}`; `/api/v1/system/status` informa `mode:"foundation"`, autenticação `development_only` (piloto), chat/memória indisponíveis. `/api/v1/openapi.json` lista as rotas operacionais e de identidade implementadas.

Valide convite, login, perfil, logout e MFA no domínio HTTPS. Cookie deve ser `__Host-jarvis_session`, Secure, HttpOnly, SameSite=Lax. No terminal do worker, `node scripts/container-smoke.mjs` deve retornar `Queue → worker → PostgreSQL synthetic probe passed`. Testes automatizados de identidade criam fixtures somente em bancos descartáveis; não executar essas suítes na VPS com dados reais.

## Persistência e atualizações

Volumes `postgres_data`, `redis_data` e `mailbox_data` preservam estado. Não execute `down -v` na VPS. `provision` é idempotente e cria/atualiza roles de aplicação em bancos existentes; isso permite adicionar `jarvis_auth` ao upgrade F01→F02. Mudanças nas senhas dessas roles exigem redeploy coordenado dos serviços. A senha administrativa `POSTGRES_PASSWORD` continua exigindo alteração explícita da role no banco antes de atualizar sua configuração; o entrypoint oficial só a inicializa em banco vazio.

Migrations 0001/0002 são transacionais e verificadas por checksum. Faça backup antes de upgrades. Reverter imagem não desfaz schema; restauração de produção será homologada na F15. O piloto não configura retenção automática de sessões expiradas, rate limits e mailbox.

As rotas públicas têm limite por conta/token (10 tentativas em 15 minutos) e um circuito global explícito (1000 tentativas admitidas em 15 minutos). Não se confia em IP enviado pelo cliente; o proxy interno aparece como peer da API. Homologação pública precisa adicionar proteção por origem no edge confiável e dimensionar limites ao tráfego. Esgotar o circuito global bloqueia temporariamente os fluxos públicos de identidade.

Imagens estão fixadas por tag e digest: Node24.19.0, PostgreSQL17.10/pgvector0.8.2 e Redis8.0.2 foram validados em containers. O fallback nativo usa PostgreSQL17.11/pgvector0.8.0. Provision atualiza a extensão para a versão padrão da imagem; atualizar imagem requer revisar patches e compatibilidade, manter backup e validar antes do deploy.

## Evidência e limitação atual

Build/startup Docker, bootstrap/provision repetido, migrations, isolamento por HTTP, mailbox, persistência e worker passaram neste cloud em 03/10/2026. Chromium e as suítes PostgreSQL também passaram. Coolify/VPS/domínio público e CI remoto ainda não foram comprovados. Consulte `docs/evidence/F02-identity.md` e `docs/evidence/F02-containers.md`.

O429 inicial deixou de ocorrer na repetição. Se ocorrer429 na VPS, configure autenticação de registry pelo mecanismo seguro do Coolify e repita o build. Falhas de schema/checksum exigem diagnóstico, nunca remoção de volumes. Não desabilite TLS. Em ambientes com proxy corporativo, o build aceita CA adicional como secret BuildKit opcional `npm_ca`; ela não é copiada para a imagem. No Coolify sem esse proxy, nenhum secret de CA é necessário.

Para Docker local, preencha `.env` ignorado e use `docker compose -f compose.yaml -f infra/compose/local.yaml up --build --wait`. Esse override publica somente web em loopback; a autenticação do modo foundation exige acesso por origem HTTPS configurada. O desenvolvimento HTTP local usa o fallback nativo do README. `.github/compose-ci.yaml` é exclusivo de CI descartável e não deve ser aplicado na VPS.
