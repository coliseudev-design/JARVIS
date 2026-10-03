# JARVIS / Projeto IronMan

Assistente pessoal multiusuário em construção. O [plano completo](PLANO_COMPLETO_IRONMAN_JARVIS.md) tem 21 fases; a [implementação organizada por agentes](docs/IMPLEMENTATION_PLAN.md) preserva os marcos MVP e V1.

**Entrega atual:** planejamento F00–F20, spike Hermes, fundação F01 e núcleo F02 com convites, login, sessões revogáveis, MFA TOTP e perfil privado protegido por RLS. Recuperação e convites usam uma caixa local privada, sem SMTP. Chat integrado e memória ainda não estão implementados. Consulte [STATUS](docs/STATUS.md) para evidências e limitações.

## Instalação na VPS / Coolify

Use o [`compose.yaml`](compose.yaml) da raiz e o [guia do Coolify](docs/runbooks/coolify.md). Ele descreve sete segredos e a origem HTTPS, serviço web/porta 8080, persistência, validação e atualização. Configure domínio somente na web.

O build e a inicialização do Compose passaram neste cloud, com testes reais de autenticação, isolamento, worker e persistência. As imagens estão fixadas por digest. Veja [evidência de containers](docs/evidence/F02-containers.md). Deploy na VPS/Coolify e CI remoto ainda não foram comprovados.

## Desenvolvimento no ambiente cloud

Pré-requisitos: Node 24.19.0, npm 11.9.0, Python 3.12+ para helpers, uv e Git. O Hermes fixa seu Python 3.14.7 separado. O fallback nativo de serviços requer Debian 13 x86_64; outras máquinas devem preferir Compose.

```bash
cd /workspace/JARVIS
bash scripts/setup-cloud.sh
npm run check
bash scripts/with-dev-env.sh npm run test:integration
npm run test:browser
python3 services/hermes-adapter/spike/run_spike.py
```

O setup usa `npm ci`, pacotes Debian assinados, lockfile Hermes congelado e configuração local privada em `.local/`. Repetir não apaga dados. Ele não publica GitHub, não faz deploy e não instala motores concorrentes. O cache npm fica em `/workspace/.cache/npm` porque o home do agente pode ser somente leitura.

Em terminais separados, depois do build:

```bash
bash scripts/with-dev-env.sh node apps/api/dist/server.js
bash scripts/with-dev-env.sh node apps/worker/dist/server.js
node scripts/serve-web.mjs
```

Para hot reload da UI, use `npm run dev:web` no lugar do servidor estático. Web estática usa porta 8080, Vite usa 5173 e API usa 3001; bind local é loopback. `GET /health/ready` verifica schema, role, pgvector e Redis. A página informa indisponibilidade quando a API não responde. OpenAPI expõe somente rotas implementadas.

O teste de navegador requer Chromium (`/usr/bin/chromium` ou `CHROMIUM_PATH`) e usa banco descartável. Pare somente o worker desta tarefa antes de `test:integration`, pois a suíte controla seu próprio consumidor; reinicie-o depois. O primeiro operador é criado pelo [procedimento de bootstrap](docs/runbooks/coolify.md#primeiro-operador-e-convites), também aplicável ao ambiente local com `scripts/with-dev-env.sh`.

Para verificar o worker em execução: `bash scripts/with-dev-env.sh node scripts/container-smoke.mjs`. Para parar DB/Redis criados pelo helper: `python3 scripts/local-services.py stop`. Encerre API/web/worker pelos próprios terminais. Não remover `.local/` sem avaliar dados existentes.

## Organização e colaboração

- `apps/web`, `apps/api`, `apps/worker`: processos da fundação.
- `packages/contracts`, `packages/database`, `packages/policy`: contratos e fronteiras comuns; política de execução externa permanece negada até a integração do broker.
- `services/hermes-adapter/spike`: experimento upstream isolado; não é a integração F05 do produto.
- `infra`, `Dockerfile`, `compose.yaml`, `.github/workflows`: instalação e validação de deploy.
- `docs/adr`, `docs/security`, `docs/contracts`, `docs/architecture`: decisões, ameaças, interfaces e storyboard.
- `docs/execplans`, `docs/evidence`, `prompts/A00_*` a `A14_*`: execução, evidências e divisão de agentes.

Leia [AGENTS.md](AGENTS.md) antes de alterar código. Na primeira onda há no máximo três filhos ativos e um escritor por contratos/migrations/lockfiles. O ambiente cloud já é isolado; não criar worktree sem pedido explícito.

## Dependências e licenças

Versões do JavaScript estão fixadas no lockfile e o Hermes em commit. Veja [versões e licenças verificadas](docs/evidence/F00-versions.md). Redis 8 oferece opções RSALv2/SSPLv1/AGPLv3; não é correto rotular essa versão como BSD. O projeto não define aqui uma licença própria para o código do produto; licenças das dependências permanecem aplicáveis.
