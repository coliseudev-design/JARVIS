# ADR 0007 — identidade e isolamento no piloto

Data: 02/10/2026. Estado: implementado no núcleo F02; homologação pública pendente.

O piloto usa sessões opacas de 256 bits, persistindo apenas SHA-256 dos tokens. Convites duram 24h, recuperação 30min e sessões 12h. Identidade vem da sessão e membership ativa; nunca de owner informado no body. Revogação é consultada a cada request. Cookies em HTTPS usam prefixo __Host-, Secure, HttpOnly e SameSite=Lax. Mutações autenticadas exigem Origin permitido e HMAC CSRF associado à sessão; fluxos públicos exigem Origin e limites de tentativas.

Senhas usam Argon2id (64MiB, t=3, p=1, salt16, tag32) pelo crypto nativo do Node24.19.0. A API Argon2 do Node ainda é experimental, motivo adicional para manter versão fixada e validar upgrades. Medição local de cinco pares hash+verify: 277/262/273/259/286ms; isso não calibra a VPS nem mede carga concorrente.

A role `jarvis_auth` lê identidade e insere o perfil inicial, mas não lê conteúdo privado. A role `jarvis_api` lê/atualiza perfil somente com RLS FORCE e tenant/user definidos por SET LOCAL na mesma transação/conexão. Colunas de ownership não são atualizáveis. Admin operacional também não tem acesso a perfis de outras pessoas. A fronteira ainda confia no processo API: alguém com execução arbitrária no servidor pode definir GUCs; RLS não é sandbox contra comprometimento integral do backend.

MFA TOTP usa RFC6238 SHA1, seis dígitos, janela ±1 de 30s e último contador consumido contra replay. Seed AES-256-GCM usa AAD vinculada ao usuário, nonce aleatório e chave externa ao banco. Matrícula exige senha e confirmação; operações administrativas exigem MFA ativo/verificado. Ativar MFA revoga outras sessões. Recuperação de senha exige o segundo fator quando ativo; não há fluxo para perda do fator nem rotação de chave com recriptografia nesta entrega.

Usuários novos entram por convite; primeiro administrador nasce somente pelo CLI privado. O piloto não oferece registro público nem seleção de múltiplos workspaces. Entrega de links é uma mailbox local com diretório0700/arquivo0600, inacessível via HTTP. Isso permite validar o fluxo sem simular envio SMTP. O operador tem acesso privilegiado a esses links e deve protegê-los e removê-los após uso/expiração.

O proxy web encaminha somente headers necessários ao contrato e fixa o destino da API. Não confia em X-Forwarded-For arbitrário. Limite persistente de 10/15min por conta/token e circuito global de 1000/15min protegem o piloto; rate limit por IP de usuário depende da futura configuração de edge confiável. O circuito global é compartilhado deliberadamente e pode afetar disponibilidade se esgotado. Limpeza automática de registros expirados continua pendente.

Revisão A01 identificou deadlock entre tokens de recuperação diferentes: foi corrigido serializando por usuário antes de bloquear token. Um teste real mantém o usuário bloqueado até duas requisições disputarem o lock e exige uma204/outra400. O perfil usa controle otimista de versão para não sobrescrever atualização concorrente silenciosamente.

Esta decisão não libera arquivos, chat/SSE, memória, jobs pessoais ou ferramentas externas. Cada novo caminho precisa aplicar e testar a mesma política; o canário do perfil não prova os caminhos ausentes.
