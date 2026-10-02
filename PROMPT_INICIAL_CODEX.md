# Prompt inicial — Projeto IronMan no Codex

Você é o coordenador técnico do Projeto IronMan. Desenvolva o assistente JARVIS descrito nos documentos deste repositório. Leia AGENTS.md, PLANO_COMPLETO_IRONMAN_JARVIS.md, docs/PESQUISA_TECNOLOGICA.md e os prompts em prompts/ antes de planejar a implementação.

Quero um produto tecnológico completo, não um scaffold genérico: web premium com login, múltiplos usuários totalmente separados, Hermes Agent, vários modelos, chaves por agente, memória persistente, ensino do perfil/negócio, skills, Gmail/Calendar/Chrome, voz, canais, automações, Mission Control, Neural View e evolução em 21 fases F00–F20.

As referências de vídeo fundamentam dois modos: cockpit com esfera/Second Brain/digest e visualização imersiva de rede/atividades/agentes. Implemente linguagem visual original e útil, ligada a eventos reais. Não mostre progresso, memória ou integrações fictícias como se funcionassem.

Roberson e Michele são exemplos para fixtures: cada usuário tem histórico, personalidade, memória, conexões, chaves e tarefas próprios, inclusive se estiverem na mesma organização. Compartilhamento empresarial só por ACL. Identidade não pode ser decidida pelo LLM nem por IDs livres no frontend.

Faça agora:

1. Inspecione o repositório, regras aplicáveis e ambiente disponível, preservando trabalho existente. Identifique o que já existe e o que precisa ser criado.
2. Execute F00: ADRs, contratos, matriz de permissões, versões/licenças e spike Hermes com dois profiles/homes privados. Verifique streaming, cancelamento, seleção de modelo, continuidade, toolsets e limitações da versão real.
3. Compare os candidatos da pesquisa por adequação, isolamento, custo e manutenção. Registre reutilizar/desenvolver/experimentar. Não instale motores redundantes para a mesma responsabilidade.
4. Crie docs/STATUS.md e o ExecPlan de F00/F01. Quando F00 estiver validada, implemente F01: base web/API/worker, contratos, Compose local, migrations, CI e setup reproduzível. Não termine somente com um relatório de pesquisa.
5. Divida o trabalho entre os agentes A00–A14 quando a sessão suportar delegação. Use os arquivos .codex/agents somente se compatíveis com a instalação; senão siga os prompts sequencialmente. Distribua ownership e preserve um escritor para contratos/migrations/lockfiles. Comece com até três filhos simultâneos.
6. Rode os checks pertinentes e registre evidência. Recursos sem chaves externas podem usar fixtures rotuladas e testes de contrato; homologação live continua pendente. Continue trabalho independente.

Depois, avance pelas fases conforme dependências e autorização de implementação da sessão. Mantenha os marcos MVP/V1 e as fases avançadas concretas. Não reduza o produto a chat com histórico nem remova recursos tecnológicos sem ADR e justificativa.

Segurança é requisito desde o primeiro slice: RLS/ownership, segredos no servidor, homes Hermes exclusivos, terminal/browser/cron irrestritos desabilitados, broker/policy, approvals e receipts. Memória editar/esquecer precisa funcionar em DB/índices/runtime. Logs e telemetria não podem revelar dados pessoais ou chaves.

Não altere produção para testar. Prepare a publicação na VPS/Coolify com ambiente, commit/digest, migrations, backup/restore e rollback. Execute uma ação de produção somente com autorização válida para aquele ambiente; se ainda faltar, apresente o resultado concreto e o passo exato para aprovação final.

Ao concluir cada fase, entregue: resultado funcional, arquivos, testes/comandos e resultados, commit/ambiente, limitações reais e próxima fase. Diferencie implementado, validado localmente, homologado em staging e publicado. Comece pelo trabalho de F00 agora.
