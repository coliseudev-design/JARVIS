# ADR 0005 — Storage privado e estado recuperável

Data: 2026-10-02. Estado: decisão aceita para desenvolvimento; operação VPS e metas de recuperação a validar. Responsáveis: A01/A13/A02.

## Decisão

Começar com storage local privado em volume fora do web root e atrás de `PrivateObjectStore`. S3 compatível é uma implementação futura do mesmo contrato, quando operação, licença/edição, custo e backup estiverem aferidos. Nenhum bucket público ou URL permanente é necessário ao piloto. Nome enviado pelo usuário nunca vira caminho físico.

Metadados SQL associam `object_id`, owner/tenant, versão, checksum, tamanho, MIME detectado, status e retenção. Chave física é gerada pelo servidor com IDs opacos e escopo; paths recebidos do cliente são proibidos. Escrita usa staging privado e rename/commit controlado; SQL só marca `ready` após confirmação do objeto. Objetos órfãos ficam para coleta com período de segurança, não para exposição automática.

API de download autentica, revalida ACL/revogação, carrega metadados e transmite arquivo com `nosniff`, tipo seguro e disposição apropriada. URLs assinadas S3 futuras devem ter TTL curto e escopo mínimo; revogação imediata do acesso via proxy é preferível quando o requisito não aceita validade residual. Logs não incluem URLs assinadas. Excluir memória/documento invalida derivados e autorizações relevantes.

Upload é quarentena → MIME/tamanho/extensão verificados → análise → extração em worker restrito → índice → pronto. Não executar arquivos. ZIP não é aceito inicialmente; futura aceitação requer proteção contra traversal, symlinks e bombas de descompressão. Preview HTML/SVG/artefato gerado deve ser sanitizado/isolado ou transformado em formato seguro; conteúdo do modelo não executa script na origem do app.

## Persistência, segredos e backup

PostgreSQL é autoridade de runs, outbox, leases e receipts. Redis pode ser reconstruído a partir de trabalhos elegíveis; reconstrução não repete efeitos externos já confirmados/incertos. Homes Hermes são privados e exclusivos por usuário/agente, e não recebem volumes do banco/storage geral.

Credenciais usam AEAD com AAD contendo owner/tenant/connection/versão e nonce exclusivo. Chave mestra fica fora do banco e de seu backup comum, com custódia/recuperação separadas. Uma cópia do banco sozinha não permite recuperar segredos; perder a chave impede recuperação. Rotação exige testar ambos os caminhos. Storage criptografado em disco e transporte TLS dependem da implantação concreta, não são garantidos por este ADR.

Backup consistente inclui dump SQL, objetos privados e estado Hermes necessário, com manifest/checksums e versão de esquema/softwares. Testar restore em ambiente isolado, com credenciais e egress de produção ausentes. Aplicar tombstones/revogações atuais antes de servir conteúdo, reconciliar leases/runs e manter rotinas pausadas. Registros atuais de revogação não podem existir somente dentro do backup antigo; definir custódia/export independente na F15.

RPO de 24h e RTO de 4h são metas do plano, não resultados. VPS, capacidade, domínio, Coolify, destino de backup e chaves de custódia ainda dependem do inventário operacional. Não instalar MinIO ou outro serviço só para preencher diagrama antes de verificar edição/licença e necessidade.

## Aceite

Troca de object ID e filename traversal falham; arquivo em quarentena não abre; revogar ACL corta novo download; checksum divergente impede `ready`; interrupção entre SQL/objeto é recuperável; quotas concorrentes resistem. Restore registra tempo medido, integridade, canários privados, tombstones, segredos recuperáveis e jobs pausados. F01 comprova apenas o que seu ambiente realmente executou.
