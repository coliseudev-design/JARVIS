# Evidência F00 — Hermes real com provider sintético

Data: 02/10/2026. Código: `services/hermes-adapter/spike/run_spike.py`. Upstream `4e3fcd5cd7e40c37cb6f9a21a76fc57a7361957a`, licença MIT, Python 3.14.7. Instalação isolada em `/workspace/.cache/jarvis`, lockfile upstream preservado. Nenhuma chave externa das famílias OpenAI/Anthropic/Google/OpenRouter foi encontrada pelo teste de presença; nenhum valor foi exibido.

Comando executado pelo coordenador após integrar A06:

```bash
python3 services/hermes-adapter/spike/run_spike.py
```

Resultado: exit 0, `status: passed`, **12 checks passaram**. Última execução revista: `/workspace/.cache/jarvis/hermes-spike-4vhg_wr1/results.json` (arquivo local, não necessário para futuro clone). Os resultados sanitizados estão em `F00-hermes-results.json`.

| Check | Observação |
|---|---|
| Dois homes/processos | Paths privados distintos e processos separados |
| Token cruzado | Token de M recebido em R → 401 |
| Canários concorrentes | Respostas R/M contêm apenas seu próprio marcador sintético |
| Response ID cruzado | ID de R consultado em M → 404 |
| Continuidade/reinício/modelo | Após terminar uma resposta, reiniciar R e continuar com `previous_response_id` preserva seu canário; fixture-b é recebido |
| SSE | Endpoint upstream de chat entrega frames `data:` e `[DONE]` com texto esperado |
| Idempotência | Duas submissões com mesma chave retornam o mesmo run |
| Run ID cruzado | ID de R consultado em M → 404 |
| Cancelamento | Run lento recebe stop e chega ao estado terminal cancelled |
| Tools desabilitadas | Nenhuma requisição à fixture recebe schema de ferramenta |
| Canários no provider | Nenhuma requisição contém marcadores de ambos os donos |
| Memória nativa desligada | Marcadores dos arquivos MEMORY/USER não entram no prompt e os arquivos não mudam |

A01 revisou o experimento e identificou XDG state compartilhado. A00 corrigiu para `<home>/state` e repetiu os 12 checks, que passaram. O primeiro erro do harness era formato de resposta a uma consulta de metadados que não era chat; a fixture passou a responder 404 a rotas não suportadas. Não houve modificação do upstream para fazer testes passarem.

Limites: provider local é uma fixture deliberada, não inferência live. Não medimos latência de tokens individualmente (SSE foi lido até o final), replay SSE de runs, queda durante run ativo, ataque de filesystem/rede, broker externo ou qualidade PT-BR. O upstream anuncia audio/realtime indisponíveis nessa API; voz do produto exige adaptador próprio. Token upstream jamais é token de usuário da aplicação.

Gate F00 local do spike atendido para decidir a arquitetura. F05 e produção continuam exigindo os testes/controles do [ADR 0006](../adr/0006-hermes.md).
