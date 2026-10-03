# Evidência de containers F01/F02

Data: 03/10/2026. Docker28.4/Compose2.40.3 no ambiente cloud; projeto descartável `jarvis-f02-validation`. Nenhum serviço da VPS foi acessado.

## Build e inicialização

O limite429 anterior do Docker Hub deixou de ocorrer. Primeiro build expôs `SELF_SIGNED_CERT_IN_CHAIN` no npm: o proxy deste cloud usa CA própria. Dockerfile agora aceita secret BuildKit opcional `npm_ca`, montado apenas durante npm ci; não desativa TLS nem incorpora o certificado à imagem. Com a CA já fornecida pelo ambiente, o build multi-stage passou, incluindo npm ci, seis workspaces e prune. Imagem usa Node24.19.0 e npm11.17.0; ambiente nativo usa npm11.9.0, ambos com o mesmo lockfile.

Compose subiu PostgreSQL, Redis, API, web e worker saudáveis. Provision e migrate encerraram0. O mesmo conjunto reiniciou preservando volumes. Role auth, schema2 e permissões da mailbox foram exercitados em runtime não-root, filesystem read-only e volume privado.

A imagem antiga `0.8.0-pg17` continha PostgreSQL17.6. O Compose foi atualizado para pgvector0.8.2/PostgreSQL17.10, com digests verificados abaixo. Upgrade do cluster descartável preservou16 contas sintéticas; provision atualizou a extensão de0.8.0 para0.8.2. O fallback nativo continua PostgreSQL17.11/pgvector0.8.0; compatibilidade foi testada nos dois caminhos.

| Imagem | Digest fixado |
|---|---|
| node:24.19.0-bookworm-slim | sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df |
| pgvector/pgvector:0.8.2-pg17 | sha256:feb68f4f15446397d8cac7f4fe48fe4586de83160d1fc48b46283312d1a33966 |
| redis:8.0.2-alpine | sha256:48501c5ad00d5563bc30c075c7bcef41d7d98de3e9a1e6c752068c66f0a8463b |

## Comportamento validado

- Bootstrap do primeiro operador pelo CLI privado; arquivo de convite criado no volume.
- `tests/integration/container-identity.mjs` executado dentro da API contra HTTP real do proxy web: HTML/readiness200, convites para R/M, cookie Secure/HttpOnly, mailbox0600, perfil de outro usuário404, logout204 e sessão revogada401. Secret CA de build ausente no runtime.
- `scripts/container-smoke.mjs`: fila→worker→PostgreSQL reais.
- Os11 testes de identidade e o navegador Chromium também passaram usando PostgreSQL/Redis de Compose. Nesse teste de navegador, API/web são processos nativos apontados aos serviços de CI; o teste anterior é o que cobre API/web em containers.
- A rede interna Docker impedia publicar portas para os testes do host. `.github/compose-ci.yaml` agora modifica somente a rede do projeto descartável e publica DB/Redis em loopback. Compose base do Coolify mantém backend interno e sem portas públicas para banco/fila.

## Limites

CI foi reproduzido localmente; resultado do GitHub Actions remoto continua desconhecido. Coolify, proxy TLS/domínio público, VPS e restauração de backup não foram executados. Requests de containers exercitam flags Secure com origem HTTPS configurada sobre transporte HTTP privado; isso não prova terminação TLS pública. Tags/digests fixos precisam de revisão de patches antes de homologação pública.

## Repetir o build neste cloud

A CA confiável é fornecida pelo ambiente em `NODE_EXTRA_CA_CERTS`. Copie somente esse certificado público para `.local/cloud-proxy-ca.crt` (ignorado), pois Buildx restringe leitura fora do contexto. Adicione `-f infra/compose/cloud-build.yaml` ao Compose e defina `NODE_EXTRA_CA_CERTS` como caminho absoluto dessa cópia apenas no comando de build. Esse override e o build foram testados; não desabilitar entitlements nem verificação TLS. O override não é necessário em um host sem esse proxy.
