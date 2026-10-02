# Pesquisa tecnológica aplicada ao Projeto IronMan

Data: 02/10/2026. Escopo: tecnologias existentes que contribuem para um JARVIS multiusuário, personalizado, com interface premium, voz, ferramentas e execução confiável.

Este documento complementa PLANO_COMPLETO_IRONMAN_JARVIS.md. Os fatos abaixo vêm de documentação primária consultada; as decisões de adoção são recomendações para o projeto. Não houve benchmark comparativo executado entre esses produtos nem auditoria de seus códigos. Disponibilidade, licença e contrato da versão instalada devem ser confirmados no desenvolvimento.

## 1. O que aproveitar de soluções já existentes

| Solução / fonte oficial | Capacidade observada na documentação | Decisão para o IronMan | Fase |
|---|---|---|---|
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) e [Profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles) | Motor de agente, perfis com estado separado e extensibilidade | Adotar como runtime; app própria aplica identidade, quotas e política | F00/F05 |
| [Open WebUI Workspace](https://docs.openwebui.com/features/workspace/) | Organização de modelos, conhecimento, prompts, skills e ferramentas | Usar como referência funcional do painel; UI própria conforme vídeos | F03/F04/F07/F08 |
| [LibreChat Agents](https://www.librechat.ai/docs/features/agents) | Configuração de agentes, capacidades e histórico de versões | Aproveitar padrão de agent builder/version history, não presumir compatibilidade de storage | F04/F08/F16 |
| [OpenClaw](https://docs.openclaw.ai/) | Gateway de assistente e superfícies/canais | Referência para onboarding de canais e continuidade; Hermes continua motor principal | F12/F19 |
| [LiveKit turn handling](https://docs.livekit.io/agents/logic/turns/) | Turnos de voz, interrupções e gestão do áudio | Adotar como candidato principal do transporte/voice session; PoC Hermes em PT-BR | F10 |
| [Pipecat transports](https://docs.pipecat.ai/client/concepts/choosing-a-transport) | Pipeline de voz com transportes compatíveis cliente/servidor | Alternativa ao LiveKit se o PoC demonstrar melhor adequação operacional | F10 |
| [OpenAI WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime) | Sessão de áudio com autenticação temporária no navegador | Implementar opção Realtime mantendo broker e identidade da aplicação | F10 |
| [Temporal Durable AI](https://docs.temporal.io/ai) | Workflows que aguardam pessoas e retomam após interrupção | Adotar para missões longas após piloto; separar ingestão leve de missão durável | F16 |
| [LangGraph](https://docs.langchain.com/oss/javascript/langgraph/overview) | Orquestração de agentes stateful com execução durável e interação humana | Comparador para AgentRuntime/WorkflowEngine; não empilhar com Hermes sem necessidade | F00/F16 |
| [Hindsight retain/recall/reflect](https://hindsight.vectorize.io/developer/api/main-methods) | Armazenamento, recuperação e reflexão sobre memória | PoC de memória temporal contra baseline; bancos privados por usuário | F17 |
| [Mem0 Graph Memory](https://docs.mem0.ai/platform/features/graph-memory) | Entidades conectadas por contexto compartilhado e recuperação de memória | Comparador; verificar edição. Documentação atual não equivale a grafo de relações tipadas | F17 |
| [Docling](https://docling-project.github.io/docling/) | Conversão/entendimento estruturado de documentos | PoC em manuais com tabelas/layout; worker de processamento isolado | F07/F18 |
| [AI SDK UI](https://ai-sdk.dev/docs/ai-sdk-ui/overview) | Chat streaming, estados de UI e objetos estruturados | Reutilizar cliente/transport se compatível com Hermes e eventos; não duplicar loop do agente | F03/F05/F18 |
| [LiteLLM Virtual Keys](https://docs.litellm.ai/docs/proxy/virtual_keys) | Gateway com chaves virtuais e controles de uso | Comparar com gateway interno; avaliar custo/edição e limites por dono/agente | F04/F20 |
| [Langfuse](https://langfuse.com/docs) | Plataforma de observabilidade e avaliação de aplicações LLM | Adotar traces/evals com conteúdo redigido e acesso controlado | F14; integração desde F05 |
| [MCP Security Best Practices](https://modelcontextprotocol.io/specification/latest/basic/security_best_practices) | Orientações de segurança para integrações MCP | Padronizar integração sem conceder privilégios implícitos | F08 |
| [A2A](https://a2a-protocol.org/latest/) | Protocolo de colaboração entre agentes | Adaptador experimental para parceiros/agentes externos; sem autoridade de autenticação própria | F16/F20 |
| [Playwright Isolation](https://playwright.dev/docs/browser-contexts) | Contextos independentes de browser | Reutilizar browser worker, sessões e fixtures; isolamento de processo adicional conforme risco | F11 |
| [Claude models](https://platform.claude.com/docs/en/models/overview), [Gemini models](https://ai.google.dev/gemini-api/docs/models) e [OpenAI](https://developers.openai.com/api/docs/) | Catálogos e capacidades por modelo/provedor | Adaptadores independentes e catálogo vivo; escolher IDs disponíveis e avaliar PT-BR/tools, sem fixar “melhor modelo” universal | F04 |
| [Deepgram models/languages](https://developers.deepgram.com/docs/models-languages-overview), [ElevenLabs models](https://elevenlabs.io/docs/overview/models) e [OpenAI TTS](https://developers.openai.com/api/docs/guides/text-to-speech) | Produtos de transcrição/síntese com capacidades distintas por modelo | Candidatos STT/TTS; validar idioma, streaming, interrupção e preço da opção específica no spike | F10 |
| [n8n Advanced AI](https://docs.n8n.io/advanced-ai/) | Ambiente de automação com recursos de IA | Conector para workflows empresariais existentes, com mandato e callbacks scoped; não um segundo scheduler do mesmo job | F13/F20 |
| [Home Assistant API](https://www.home-assistant.io/integrations/api/) | API para integração de automação residencial | Primeiro conector de dispositivos após companion/policy; comandos por entidade autorizada | F19 |

### Reutilizar, desenvolver e avaliar

**Reutilizar:** Hermes, PostgreSQL/pgvector, bibliotecas UI, Playwright, LiveKit quando PoC aprovado, Temporal para a fase de missões e ferramentas de observabilidade/documentos selecionadas.

**Desenvolver para este produto:** identidade/ownership, política central, contratos, memória e ensino do negócio com consentimento, interface dos dois vídeos, cofre por agente, controles de custo, broker, ACL empresarial e ciclo de aprovações.

**Avaliar sem instalação automática:** Hindsight/Mem0, LiteLLM, LangGraph, Pipecat e A2A. Comparações reduzem risco de reinventar recursos, mas não justificam manter duas fontes de memória ou dois coordenadores da mesma execução.

Não copiar repositórios/temas/código antes de verificar a licença atual e suas condições. Opções cloud e self-host podem ter capacidades e custos diferentes. “Está na documentação” não significa que uma edição gratuita instalada possui todos os recursos.

## 2. Tecnologias que elevam o produto além de um chat

| Capacidade | Implementação prevista | Evidência mínima de funcionamento |
|---|---|---|
| JARVIS individual | Ownership, RLS, perfil Hermes exclusivo e contexto autenticado | Canários privados não cruzam usuários nem no mesmo tenant |
| Personalização contínua | Perfil versionado, propostas de memória e feedback explícito | Nova preferência substitui a anterior e pode ser desfeita |
| Memória temporal | Validade, versões, origem, episódios e retrieval temporal | Responde corretamente “antes/agora” sem confundir versões |
| Ensino do negócio | Wizard, fontes, políticas aprovadas e perguntas de validação | Resposta usa o manual autorizado vigente e cita sua origem |
| Mission Control | Run events, DAG tipado, tarefas, resultados e cancelamento | Três subtarefas mostradas correspondem a runs reais |
| Workflows duráveis | Temporal com Activities e recibos idempotentes | Queda durante espera humana não duplica ação externa |
| Voz natural | LiveKit/pipeline com STT, VAD, TTS e interrupção | Medição de PT-BR e p95 em dispositivos documentados |
| Multi-modelo inteligente | Capacidades, política de dados, budgets e fallback | Falha de provider não usa chave alheia nem repete envio |
| Ferramentas extensíveis | Tool schemas, broker, MCP e skill packages revisados | Ferramenta não autorizada não executa, mesmo via injection |
| Deep research | Plano limitado, coleta, fontes, síntese e revisão | Relatório tem fontes existentes e custo/limite registrados |
| Artefatos interativos | JSON/schema + renderer de componentes permitidos | Não executa JavaScript/HTML arbitrário gerado por IA |
| Neural View | Animação GPU quando disponível e eventos reais | Nó abre agente/fonte/run correto; fallback funciona |
| Conhecimento visual | Grafo de memórias/documentos com relações e confiança | Nós inacessíveis não entram na consulta do cliente |
| Computador local | Bridge/extension com pareamento e capacidades | Revogar dispositivo impede próximos comandos |
| Proatividade | Mandato de rotina, fontes e orçamento | Digest usa a agenda certa e registra falhas parciais |
| Qualidade evolutiva | Datasets, avaliações, traces e versões | Mudança tem comparação e rollback antes de ativação geral |

## 3. Como selecionar sem perder coesão

O arquiteto aplica uma matriz proposta: segurança/isolamento 25%, adequação ao produto 20%, confiabilidade/recuperação 20%, manutenção/licença 15%, custo operacional 10% e experiência/desempenho 10%. Pesos podem mudar em ADR com justificativa. Não atribuir notas sem dados; marcar desconhecido e executar spike.

O resultado de cada avaliação deve conter: fonte oficial, release/commit, edição/licença, operação suportada, integração com ownership, esforço, recursos de VPS, custo, teste executado e alternativa. Comparar no mesmo corpus e com a mesma política de privacidade.

### Spikes obrigatórios

1. Hermes: dois homes, streaming, cancelamento, modelos, ferramentas limitadas e reinício.
2. Voz: LiveKit → adaptador Hermes → TTS; interrupção e custo em PT-BR; comparar Pipecat somente se houver dúvida concreta.
3. Model gateway: provider escolhido realmente serve o modelo solicitado; parâmetros não suportados falham explicitamente.
4. Documentos: extração simples versus Docling num corpus sintético de manuais, tabelas e páginas digitalizadas.
5. Memória: baseline versus candidato Hindsight/Mem0, avaliando validade temporal, esquecimento e isolamento.
6. Workflows: três Activities, uma aprovação e kill/replay; incluir retorno externo incerto sem retry cego.
7. Interface: GPU/celular de referência, animação reduzida, estados reais e navegação acessível.

## 4. Gateway de modelos e credenciais

Preferência arquitetural: o Hermes chama um gateway/adaptador autenticado com credencial scoped ao usuário/agente/run, e o serviço resolve o segredo do fornecedor. A chave nativa não precisa ser persistida num .env de home compartilhado.

O contrato de compatibilidade precisa ser validado: tradução de streaming, mensagens de ferramenta, imagem, campos de raciocínio permitidos, usage e erros. Nem todo recurso nativo cabe num protocolo compatível. Quando uma integração exigir chave direta no runtime, ela será injetada por mecanismo efêmero, com leitura de filesystem/terminal restrita e sem gravação em memória/config/export. Essa exceção exige ADR e teste de ausência de persistência/leak.

LiteLLM pode atender parte dessa responsabilidade, mas permissões de negócio, ownership de conexão, consentimento, memória e aprovações continuam na aplicação. Chaves virtuais não substituem autenticação de usuário.

## 5. Missões realmente autônomas, com limites

Mandato: objetivo, ferramentas/contas permitidas, dados acessíveis, duração, orçamento, destinatários/alvos, condições de aprovação e critério de conclusão. O planejamento pode ser feito por IA; a execução valida cada ação em código.

Explicação visível: etapas, fontes e resultados. Não exibir pensamento privado. Um progresso percentual exige denominator conhecido, como subtarefas concluídas; quando não existe, mostrar estado/progresso indeterminado.

Mission Control permitirá: abrir cada agente, consultar evidência, cancelar subtarefa, aprovar proposta, baixar resultado, retomar trabalho seguro e ver consumo. Reexecutar uma missão cria novo run; ações já concluídas precisam de reconciliação e não são copiadas automaticamente.

## 6. Interface dos dois vídeos: decisão final

Construir linguagem visual original combinando o primeiro vídeo, que aproxima JARVIS de um painel pessoal, com o segundo, que apresenta uma rede tecnológica e agentes paralelos. Não copiar identidade de terceiros nem usar métricas fictícias para impressionar.

Esfera e Neural View têm materiais, partículas, conexões e transições coerentes. A animação responde a áudio ou telemetria agregada permitida, nunca a números inventados. Em CPU fraca/mobile, reduzir partículas e usar renderer 2D. Respostas, fontes e controles são HTML acessível fora do canvas.

O impacto visual é requisito com aceite em F03/F05/F18. Acessibilidade e desempenho integram esse aceite, e não ficam para uma revisão futura.

## 7. Condições conhecidas

- Hermes é um framework de agente; a documentação de perfis não substitui uma plataforma SaaS multiusuário segura.
- Produtos de referência não foram auditados nem “declarados melhores” por este levantamento.
- Recursos cloud de voz, memória ou observabilidade podem exigir contrato/licença e não existir no self-host.
- Gmail possui restrições de escopos/verificação; planejar a dependência externa com antecedência.
- VPS não acessa Chrome local nem microfone permanente sem componente e consentimento específicos.
- Memória não melhora a qualidade automaticamente: recall, versões, esquecimento e isolamento precisam de testes.
- Durable execution não elimina efeitos externos duplicados sem idempotência/reconciliação.
- Não existe garantia de coletar literalmente toda tecnologia já criada; este plano seleciona famílias relevantes com fontes verificáveis e prevê reavaliação na implementação.

O objetivo é um sistema tecnológico consistente e evolutivo, com todas as escolhas importantes justificadas por benefício, teste e custo operacional.
