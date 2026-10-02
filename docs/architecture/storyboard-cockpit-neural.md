# Storyboard acionável — Cockpit, Second Brain e Mission Control

Data: 2026-10-02. Fonte: descrições textuais dos dois vídeos no plano. Os MP4s não foram fornecidos nesta sessão; não houve nova inspeção de frames e não se afirma fidelidade visual verificada. A04 implementa; A14 registra screenshots, teclado e medição no hardware usado.

## Linguagem visual e limites

Fundo `#070B16`, superfície `#111A2E`, texto `#E9F0FF`, ciano `#40D9FF`, violeta `#9B7BFF`. Tokens de foco/erro/sucesso precisam ser aferidos para contraste WCAG 2.2 AA; a paleta sozinha não comprova contraste em transparências. Tipografia legível e monoespaçada só em IDs/métricas. Espaçamento em escala consistente, bordas suaves e brilho limitado deixam a conversa prioritária.

Esfera central usa renderer lazy, com SVG/CSS em dispositivo fraco/reduced motion. WebGL/Three.js é candidato, não requisito para funcionalidade. Inatividade/aba oculta pausa loop; falha GPU mantém texto/controles HTML acessíveis. Estado sempre tem rótulo/ícone, nunca só cor. Não exibir neurônios, pensamentos internos, porcentagens de confiança inventadas ou métricas aleatórias para animar.

## Sequência de telas e interação

| Quadro | Composição e ação | Dado que o torna real | Vazio/falha e acessibilidade |
|---|---|---|---|
| 1 — Acesso | Marca discreta, login/convite, recuperação | Sessão validada pelo servidor | Erro genérico sem enumeração; labels/foco; não simular sessão |
| 2 — Conhecer a pessoa | Passos curtos: nome, fuso, resposta, consentimento; negócio opcional | Perfil versionado e receipt | Permitir pular opcionais; indicar o que será salvo |
| 3 — Cockpit inicial | Sidebar, esfera com estado, conversa central, coluna de agenda/contexto | Conexões/capabilities autorizadas | Agenda não conectada convida conectar; não inventar compromissos |
| 4 — Envio | Campo expansível, anexos, botão enviar; mensagem fica pendente até aceite | `message_id/run_id` de POST idempotente | Falha permite retry com mesma chave; foco permanece no composer |
| 5 — Resposta | Delta legível, botão cancelar, fontes em chips, detalhes operacionais recolhíveis | Eventos ordenados + mensagem final | Reconectando sem reenvio; `aria-live` moderado em chunks |
| 6 — Aprovação | Painel com conta, alvo/destinatário, conteúdo, efeito, prazo; aprovar/recusar | Intenção imutável e `intent_hash` do servidor | Expirada não tem botão ativo; mudanças criam nova intenção |
| 7 — Memória | Item, origem, validade, status, editar/esquecer; recibo explícito | Memória/versões autorizadas | Proposta separada da aprovada; exclusão “em andamento” |
| 8 — Second Brain | Grafo navegável + busca/filtros + lista equivalente; painel da fonte | Nós/arestas persistidos de memória/documentos acessíveis | Sem dados mostra convite a adicionar fonte; revogados somem |
| 9 — Mission Control | Rede de agentes/runs, timeline, subtarefas, resultados e custos conhecidos | Run events, edges de delegação/tools/source refs | Sem missão mostra explicação, sem agentes fingindo trabalhar |
| 10 — Conteúdo | Preview, fonte, formato e download do artefato | `artifact.ready` + download autorizado | Geração falha não deixa download falso; renderer valida schema |
| 11 — Voz | Push-to-talk, transcript, mute, parar fala e estado | Voice session vinculada, STT/TTS reais | Mic negado oferece texto; feature indisponível explica dependência |
| 12 — Retomada | Histórico do run, efeito concluído/incerto, próxima ação segura | Receipts/reconciliação | Cancelar não promete desfazer e-mail; unknown pede revisão concreta |

Agenda/resumo/conteúdo avançado entram nas fases correspondentes. F03 pode mostrar fixtures com rótulo persistente “Demonstração — dados sintéticos”; fixture não dispara endpoint externo. Botão de recurso não implementado tem estado indisponível e razão, não ação vazia.

## Estados da esfera

| Estado exibido | Gatilho permitido | Representação com texto |
|---|---|---|
| Inativo | Nenhum run/áudio ativo | Esfera estática, “Pronto para conversar” |
| Ouvindo | Permissão mic concedida e captura ativa | Waveform da amplitude real, botão parar |
| Transcrevendo | Job STT ativo | Movimento curto/indeterminado, transcript quando chegar |
| Preparando resposta | Run `queued/running`, sem efeito ativo | Anel discreto, sem contagem fictícia |
| Usando ferramenta | `tool.started` do run | Nome/resumo permitido, duração aferida |
| Aguardando autorização | Aprovação pendente | Anel pausado e CTA para intenção |
| Falando | Reprodução de áudio real | Waveform de saída, interromper |
| Interrompido | Cancelamento/worker interruption conhecido | Razão e status dos efeitos |
| Indisponível | Dependência/capability indisponível | Texto de falha com retry seguro quando aplicável |

Conflitos simultâneos usam prioridade: aprovação/erro relevante → fala/escuta → ferramenta → resposta → inativo. Sessão de voz e run têm controles próprios: parar áudio não é rollback de ferramenta. Não fazer a esfera “ouvir” quando mic está desligado.

## Neural View: relações sem enganar

Dois modos explicitamente nomeados: **Conhecimento** mostra fatos/documentos e origem; **Execução** mostra runs, agentes e chamadas/delegações persistidas. Alternar modo troca dataset/legenda, não só cor. Cada nó tem tipo/id/status autorizado; cada aresta tem relação registrada. Seleção abre detalhe HTML da fonte/agente/run. Tooltips só mostram conteúdo autorizado, incluindo busca e export.

Clusters luminosos agrupam função (planejamento, memória, conhecimento, linguagem, ferramentas, execução); são metáfora de navegação, não arquitetura neural do modelo. Pulso de nó vem de evento real e decai visualmente; não inventa quantidade de trabalho. F16 permite “2 de 3 subtarefas concluídas” quando o DAG realmente define três tarefas. Custo desconhecido aparece como “não disponível”; custo estimado tem rótulo e tarifa/horário.

Timeline/lista equivalente tem todos os controles: abrir fonte, cancelar subtarefa quando permitido, revisar aprovação, baixar resultado e consultar consumo. Navegação por teclado/reader não depende de coordenadas canvas, drag ou hover. Transição entre cockpit/neural preserva conversa/run selecionado e foco previsível.

## Layout, verificação e evidência

- 390×844: conversa/composer como tela principal, sidebar em drawer, contexto em sheet, esfera compacta, Neural em lista por padrão.
- 768×1024: navegação recolhível e contexto sob demanda; sem comprimir três colunas ilegíveis.
- 1440×900 e 1920×1080: conversa central e contexto lateral; Neural full-screen opcional com timeline persistente.

Em cada viewport verificar vazio/carregando/sucesso/falha/sem permissão/desconectado, teclado, foco de modais, contraste, zoom 200%, reduced motion e texto longo. Teste automatizado de acessibilidade complementa revisão manual; não comprova WCAG inteiro sozinho.

Meta do plano é 60 fps em máquina de referência. Registrar navegador/GPU/viewport/número real de nós, frame times e uso inativo; se falhar, reduzir partículas/nós/efeitos ou renderer 2D. Nenhum benchmark foi executado neste storyboard. Capturar screenshots das rotas com fixtures rotuladas e das integrações reais separadamente. Aceite premium F03 inclui composição/estados/acessibilidade; aceite F05/F18 inclui correspondência entre UI e execução real.
