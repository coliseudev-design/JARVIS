# JARVIS — instruções de desenvolvimento

Leia `PLANO_COMPLETO_IRONMAN_JARVIS.md`, `docs/PESQUISA_TECNOLOGICA.md`, `docs/STATUS.md` (quando existir) e o ExecPlan da fase antes de alterar o produto. O plano descreve requisitos; evidências de funcionamento ficam em `docs/evidence/`.

- A00 coordena A01–A14. No máximo três agentes filhos simultâneos nesta primeira onda, com ownership explícito. Não crie worktrees neste ambiente cloud isolado, salvo pedido explícito do usuário.
- Contratos, migrations, lockfiles e políticas comuns têm um único escritor designado por onda. Não sobrescreva arquivos de outro agente.
- Identidade é derivada da sessão pelo servidor. Memória, credenciais, arquivos, runs, filas e homes Hermes são privados por usuário/agente, inclusive dentro do mesmo tenant. Administração não concede acesso ao conteúdo.
- Nunca grave segredos em código, documentos, fixtures ou logs. Use dados sintéticos rotulados. Não represente integrações, métricas ou progresso simulados como reais.
- Ferramentas com efeitos externos passam por policy/broker, aprovação válida quando necessária, idempotência e receipts. Terminal, cron e browser irrestritos ficam desabilitados no runtime do produto.
- Mantenha código, contratos e testes coerentes; rode checks pertinentes e registre resultados sem confundir testes locais, live, staging e produção.
- Atualize `docs/STATUS.md` e o ExecPlan ao integrar cada entrega. Registre bloqueios externos e continue trabalho independente. Não declare fases concluídas por documentação ou mocks apenas.
- Produção depende de ambiente e ação concretos autorizados. Nunca use produção para validar migrations, restauração ou efeitos externos.

Os agentes de desenvolvimento não são os agentes do produto. Prompts Markdown em `prompts/` são o mecanismo portátil; não invente configuração `.codex/agents` incompatível com a instalação.
