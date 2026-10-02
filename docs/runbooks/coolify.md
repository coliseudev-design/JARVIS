# Instalar a fundação JARVIS no Coolify

Este release é **F01 — fundação**, com interface de estado, API, worker sintético, PostgreSQL/pgvector e Redis. Login, chat Hermes integrado, memória e conexões não estão liberados. Não cadastrar dados pessoais ou chaves de modelos nesta etapa. O spike Hermes F00 é um experimento separado, não um serviço de produto neste Compose.

## Configuração do recurso

1. No Coolify, crie um recurso de aplicação a partir do repositório `coliseudev-design/JARVIS`, branch `main`, usando **Docker Compose**.
2. Diretório base: `/`. Arquivo Compose: `/compose.yaml`. O build usa o `Dockerfile` da raiz.
3. Configure as cinco variáveis abaixo no ambiente seguro do recurso. Gere um valor **diferente** para cada uma com `openssl rand -hex 32` na sua máquina. Nunca cole os valores no chat ou faça commit do `.env` preenchido.
4. Atribua um domínio HTTPS **somente ao serviço `web`, porta interna 8080**. O proxy do Coolify deve conseguir alcançar a rede desse serviço; verifique a integração de rede do recurso conforme sua versão do Coolify. Não atribua domínio/portas públicas a postgres, redis, api, worker ou migrate.
5. Faça o deploy na VPS. A ordem é: banco/Redis saudáveis → migration concluída → API saudável → worker/web. `migrate` encerrado com código 0 é esperado, não uma aplicação permanentemente ativa.

| Variável | Uso |
|---|---|
| `POSTGRES_PASSWORD` | Bootstrap administrativo do banco; só no serviço postgres |
| `JARVIS_API_PASSWORD` | Role de leitura operacional da API |
| `JARVIS_WORKER_PASSWORD` | Role do worker, distinta da API |
| `JARVIS_MIGRATOR_PASSWORD` | Role que assume owner para migration; só no job migrate |
| `REDIS_PASSWORD` | Autenticação da fila interna |

Use 64 caracteres hexadecimais em todos os valores: isso permite formar URLs de conexão sem codificação ambígua. Há nomes sem valores em `.env.coolify.example`. O Compose recusa variáveis obrigatórias vazias. O script de bootstrap do banco valida formato e cria roles separadas.

## Aceite da instalação

No domínio configurado, a página deve carregar e informar fundação disponível para desenvolvimento, com login/chat/memória indisponíveis. `GET /health/ready` deve responder 200 com `{"status":"ready"}`; `GET /api/v1/system/status` deve retornar `mode:"foundation"`, sem hosts, paths ou segredos. `GET /api/v1/openapi.json` lista somente as três rotas operacionais implementadas.

No terminal do serviço worker, execute `node scripts/container-smoke.mjs`. O resultado deve ser `Queue → worker → PostgreSQL synthetic probe passed`. Isso testa fila, consumidor e gravação real; um container apenas em execução não basta.

## Persistência e atualizações

Volumes nomeados `postgres_data` e `redis_data` preservam estado entre reinícios. Não execute `down -v` na VPS. O entrypoint de roles roda **somente no primeiro banco vazio**: mudar uma senha no painel não altera uma role já existente. Rotação exige alterar a senha da role no banco e atualizar a variável correspondente, seguida de redeploy coordenado. Não apagar volume para rotacionar credenciais.

Migrations têm checksum e transação: uma versão aplicada não pode ser editada. Backup antes de upgrades que alterem dados. Até existir runbook de restauração homologado em F15, esta instalação é ambiente de avaliação da fundação. Não há garantia de rollback de migration destrutiva; reverter imagem não desfaz schema.

O Compose fixa tags, mas digests das imagens ainda precisam ser registrados após o primeiro pull bem-sucedido. Validação local usou PostgreSQL Debian 17.11/pgvector 0.8.0 e Redis 8.0.2; a tag pgvector pode conter outro patch de PostgreSQL 17. A homologação Docker deve confirmar esse detalhe e aplicar patches de segurança antes de release público do produto.

## Evidência e limitação atual

Schema do Compose validado, bootstrap SQL do mesmo entrypoint testado em cluster PostgreSQL vazio, migrations repetidas e aplicação validada nativamente. O build Docker neste cloud foi bloqueado por **HTTP 429 do Docker Hub** ao buscar a imagem Node. Portanto, o build completo e o deploy Coolify **ainda não foram comprovados** nesta sessão; o CI versionado executará esse caminho quando houver acesso ao registry.

Se a VPS receber o mesmo erro 429, configure autenticação do Docker Hub no mecanismo seguro de registry do Coolify e repita o pull/build. Não desabilite TLS e não substitua imagens por fontes desconhecidas. Erro de variável ausente é resolvido no painel do recurso. Falha de migration em banco já preenchido exige inspecionar schema/checksum; não remover volumes.

Para Docker local, copie o template para um `.env` ignorado e preencha os valores. Use `docker compose -f compose.yaml -f infra/compose/local.yaml up --build --wait`; somente a web será publicada em loopback. O cloud desta sessão usa o fallback nativo descrito no README devido ao rate limit do registry.
