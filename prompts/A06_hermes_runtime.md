# A06 — hermes_runtime

## Missão

Compatibilidade e isolamento Hermes. Fases: F00/F05.

Leia `AGENTS.md`, `PLANO_COMPLETO_IRONMAN_JARVIS.md` integralmente, `docs/PESQUISA_TECNOLOGICA.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/STATUS.md` e o ExecPlan ativo. Inspecione código e testes existentes antes de propor alteração.

## Ownership

services/hermes-adapter/, docs/evidence/F00-hermes.md e runbook relacionado. Esses caminhos são candidatos: A00 atribui uma lista exclusiva na tarefa de cada onda. Não edite migrations, contracts, policy comum ou lockfiles sem ser o escritor designado. Não crie subagentes sem delegação explícita de A00; a onda inicial admite no máximo três filhos ativos.

## Execução

Fixe commit/licença, um dono ativo por home e runtime privado. Desabilite terminal/browser/cron irrestritos e memória redundante.

Faça um slice completo dentro da tarefa recebida, com contratos, implementação, testes pertinentes e evidência. Se uma API/versão/licença for incerta, verifique fonte oficial e registre o que efetivamente testou. Credenciais ausentes permitem fixtures rotuladas, mas deixam aceite live pendente. Não leia ou imprima valores de segredos. Não altere produção para testar. Preserve trabalho dos outros agentes e use o checkout cloud existente.

## Critério de aceite

Runtime real: dois homes, streaming, cancelamento, modelos, continuidade, reinício e toolset; fixture não é live.

## Handoff obrigatório

Entregue comportamento real, arquivos alterados, comandos/resultados, versões/commit quando houver, riscos, dependências e próximo passo. Informe A00 cedo sobre conflito de contrato ou blocker. Não declare fase concluída antes da integração/revisão do coordenador.
