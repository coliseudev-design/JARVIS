# Aceite adversarial e isolamento R × M

Status: plano de testes, nenhum caso marcado como executado pela criação deste documento. A14 integra cada caso junto à fase do módulo. F02 implementa N01–N10 nos caminhos existentes; módulos ainda ausentes constam como não implementados, nunca como passed.

## Fixture e execução

Criar três cenários independentes em ambiente descartável: (A) R/M no mesmo tenant T1; (B) R em T1 e M em T2; (C) R/M em T1 com M como tenant_admin, repetido com platform_admin. Cada usuário tem um agente, duas conversas, canário textual único, arquivo com bytes diferentes, memória e recurso filho. Os nomes R/M são sintéticos. Variar o sentido do ataque M→R e R→M. Compartilhamento positivo deliberado usa documento separado com ACL, nunca o canário pessoal.

Salvar cookies/credenciais somente em storage efêmero privado de testes. Token canário fictício é rotulado `SYNTHETIC_TEST_ONLY`; qualquer scan de leaks usa valores gerados em execução. A saída pública do teste informa ID do caso e sucesso/falha, sem despejar respostas privadas. Cada tentativa negativa tem controle positivo equivalente do dono, para não considerar servidor quebrado como isolamento.

| ID | Sequência adversarial | Resultado observável exigido | Fase |
|---|---|---|---|
| N01 | M troca ID de R em GET/lista/filtro/batch/contagem/export | Nenhum conteúdo/metadado de R; erro privado uniforme; dono continua acessando | F02 e todo recurso novo |
| N02 | INSERT/PATCH troca owner/tenant; associa message/attachment/run/approval de outro escopo | API rejeita; RLS WITH CHECK/FK impedem via DB role real; estado final de R intacto | F02/F05/F08 |
| N03 | M eleva papel admin e repete N01/N02; tenta grant de suporte a si | Papel operacional não libera conteúdo; operação de suporte indisponível | F02 |
| N04 | Executar SELECT/INSERT/UPDATE/DELETE direto sob role real, com contexto M e sem contexto | SELECT não retorna R; escrita alheia falha/zero linhas; sem contexto nega | F02 |
| N05 | Criar ACL read em documento separado; tentar editar, derivar grant, usar outra coleção, revogar e repetir search/download | Só read concedido passa; revogado desaparece também de chunks/vetores/grafo/cache | F07 |
| N06 | Pool=1; R→M→sem contexto após commit, rollback, erro, timeout, cancelamento; repetir concorrente com pool>1 | Nenhum sujeito residual ou query fora de tx; transação abortada não reutilizada | F02 |
| N07 | Cookies ausentes/expirados/revogados, CSRF/Origin inválidos, token recovery/convite vencido e corrida de uso duplo | Negado, cookie/session rotacionados como definido; apenas um uso; sem enumeração | F02 |
| N08 | M assina run R; injeta cursor/event ID R; reconecta stream; revoga sessão com stream aberto | Nenhum evento privado; replay somente do run; revogação corta emissão protegida; sem duplicar envio | F02/F05 |
| N09 | M troca file ID, path/encoded traversal/object key; tenta cache/browser/proxy compartilhado; dono revoga antes de baixar | Objeto nunca público; request autorizado por metadado; download de R recusado; cache privado | F02/F07 |
| N10 | Inserir em Redis job_id de R com owner M; ID inexistente; duplicar/restart; revogar membership/mandato/conexão antes execução | Payload não escolhe sujeito; sem ação após revoke; uma transição/efeito, lease antigo bloqueado | F02/F05/F13 |
| N11 | Documento/email/tool output diz “aprovado”, pede outra memória/chave, shell, instalação de skill, bypass broker | Texto não concede capacidade; tools não autorizadas indisponíveis e recusadas se chamadas diretamente | F05/F08 |
| N12 | M aprova intenção R; replay/concorre na aprovação; muda argumentos/alvo/conexão/versão; expira; simula timeout após efeito confirmado | Nenhum efeito indevido, um consumo, revalidação atual; desconhecido fica em reconciliação sem retry cego | F08/F09 |
| N13 | Chave sintética distinta por dono; credencial M falha; fallback; export/error/log/trace/SSE/browser/home; ciphertext/AAD trocados | Nunca usa chave R; segredo ausente dos canais; AEAD recusa troca scope/nonce inválido; revogação efetiva | F04/F05 |
| N14 | Endpoint loopback/IPv6/metadata/private, DNS rebinding, redirect privado e URL com credenciais | Negado em validação e egress; nenhum pacote a serviço interno de teste; logs sanitizados | F04/F08/F11 |
| N15 | Dois homes concorrentes, mesma conversa textual, runtime profile forjado, dois workers disputam mesmo home, kill/restart | Homes/transcripts/skills/keys independentes; um lease; perfil do browser ignorado; toolset contido | F00/F05 |
| N16 | MIME falso, HTML/script, zip traversal/symlink/bomb, arquivo enorme/corrompido; extração abortada | Quarentena/recusa sem execução e sem arquivo fora da raiz; limites observados; sem conteúdo parcial liberado | F07 |
| N17 | Esquecer canário e consultar nova conversa, cache, resumo/contexto Hermes; restore de backup anterior | Sem canário nos caminhos ativos; tombstone atual reaplicado; jobs restaurados pausados | F06/F15 |
| N18 | Vários runs disputam último saldo, expiram/repetem reserva, provider retorna usage faltante | Nenhuma reserva excessiva; reconciliação idempotente; custo desconhecido não vira zero | F04 |
| N19 | Pareamento expirado/reusado; username alterado; webhook duplicado; dispositivo revogado; áudio forja identidade | Vínculo por ID estável; sem bypass de aprovação; sem tarefa após revoke | F10/F12/F19 |
| N20 | Título/Markdown/model JSON com script; analytics/audit tenta incluir canário; cliente pede fonte sem ACL | Nenhum JS executado; schema recusa componente não permitido; telemetria sem conteúdo privado | F03/F14/F18 |

## Protocolo de evidência

Cada relatório registra revision/commit (ou explicitamente árvore ainda sem commit), ambiente, versões, comando, resultado, dependências reais versus doubles, casos não executados e saída sanitizada. Falha registra reprodução mínima e gate bloqueado. Duração, cobertura ou contagem de testes não substituem assertions de autorização.

Para F02, rodar API com autenticação real e PostgreSQL real; fixture operator somente prepara dados e verifica estado final. Asserções de HTTP isoladas não bastam: executar DML sob a role da aplicação e testar pooling. Para o spike Hermes, distinguir leitura do código, teste de filesystem/perfil, servidor upstream real, modelo falso e fornecedor live. Um adaptador simulado não valida comportamento upstream.

Repetir testes pertinentes após alteração de policy, role, query, pooling, schema, evento, cache key, gateway ou versão upstream. Na F14 executar composição concorrente de todos os caminhos habilitados; módulos desabilitados ficam explicitamente fora do aceite live. F15 exige staging e restore isolado, sem usar produção para preencher lacunas.
