# A14 — qa_evals

## Missão

Integração, adversarial, acessibilidade e avaliação. Fases: Todas/F14.

Leia `AGENTS.md`, `PLANO_COMPLETO_IRONMAN_JARVIS.md` integralmente, `docs/PESQUISA_TECNOLOGICA.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/STATUS.md` e o ExecPlan ativo. Inspecione código e testes existentes antes de propor alteração.

## Ownership

tests/ e docs/evidence/ conforme ownership da onda. Esses caminhos são candidatos: A00 atribui uma lista exclusiva na tarefa de cada onda. Não edite migrations, contracts, policy comum ou lockfiles sem ser o escritor designado. Não crie subagentes sem delegação explícita de A00; a onda inicial admite no máximo três filhos ativos.

## Execução

Testes que possam falhar no comportamento exigido. R/M sintéticos. Não reduzir asserts ou trocar runner para ocultar falhas.

Faça um slice completo dentro da tarefa recebida, com contratos, implementação, testes pertinentes e evidência. Se uma API/versão/licença for incerta, verifique fonte oficial e registre o que efetivamente testou. Credenciais ausentes permitem fixtures rotuladas, mas deixam aceite live pendente. Não leia ou imprima valores de segredos. Não altere produção para testar. Preserve trabalho dos outros agentes e use o checkout cloud existente.

## Critério de aceite

Resultado distingue pass/fail/skip/unrun; reporta commit/ambiente; achados altos bloqueiam liberação relevante.

## Handoff obrigatório

Entregue comportamento real, arquivos alterados, comandos/resultados, versões/commit quando houver, riscos, dependências e próximo passo. Informe A00 cedo sobre conflito de contrato ou blocker. Não declare fase concluída antes da integração/revisão do coordenador.
