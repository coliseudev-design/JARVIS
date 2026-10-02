# Versões e licenças verificadas

Data: 02/10/2026. Ferramentas observadas: Node 24.19.0; npm 11.9.0; TypeScript 5.9.3; Python do host 3.12.14, Hermes 3.14.7; Docker 28.4.0; Compose 2.40.3. Máquina reportou aproximadamente 33 GiB RAM e 30 GiB livres na inspeção inicial; isso não descreve a VPS do usuário.

| Componente instalado | Versão | Licença observada / fonte |
|---|---|---|
| React / React DOM | 19.3.0 | MIT, manifests npm |
| Fastify | 5.12.5 | MIT, manifest npm |
| Vite | 8.3.2 | MIT, manifest npm |
| TypeScript | 5.9.3 | Apache-2.0, manifest npm |
| Zod | 4.6.5 | MIT, manifest npm |
| pg | 8.23.1 | MIT, manifest npm |
| BullMQ | 6.3.11 | MIT, manifest npm |
| ioredis | 6.0.0 | MIT, manifest npm |
| Drizzle ORM | 0.45.3 | Apache-2.0, manifest npm; reservado para schemas F02, migration F01 usa SQL explícito |
| Vitest | 5.0.3 | MIT, manifest npm |
| PostgreSQL Debian | 17.11-0+deb13u1 | PostgreSQL + avisos de componentes em `usr/share/doc/postgresql-17/copyright` |
| pgvector Debian | 0.8.0-1 | PostgreSQL, arquivo copyright do pacote |
| Redis Debian | 8.0.2-3+deb13u2 | Escolha RSALv2 / SSPLv1 / AGPLv3 no copyright; componentes têm licenças próprias |
| Hermes | commit `4e3fcd5cd7e40c37cb6f9a21a76fc57a7361957a` | MIT, LICENSE upstream |

Lockfile npm mantém versões e hashes de integridade. Os pacotes Debian foram adquiridos via índice assinado pelo keyring Debian e extraídos no workspace, sem desabilitar verificação. O installer mantém as versões exatas; caso desapareçam do mirror, atualizar por decisão revisada ou fonte oficial de snapshot, nunca ignorar assinatura/checksum.

Redis fica serviço separado, sem modificações de código; preservar avisos e cumprir a licença escolhida quando houver redistribuição/alteração. Esta identificação não é uma auditoria jurídica do produto comercial F20. A licença própria do JARVIS ainda não foi definida pelo titular.

Não instalados: motores alternativos LangGraph, Mem0/Hindsight, LiveKit/Pipecat, Temporal, Docling e Langfuse. São candidatos/tecnologias de fases futuras conforme ADRs; não há benchmark ou licença de edição instalada para atestar ainda.

Imagens propostas `node:24.19.0-bookworm-slim`, `pgvector/pgvector:0.8.0-pg17`, `redis:8.0.2-alpine` ainda não foram baixadas neste cloud por HTTP 429; não se afirma digest ou patch interno verificado. Não substituir a evidência nativa por declaração de testes Docker.
