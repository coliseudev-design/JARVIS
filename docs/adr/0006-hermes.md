# ADR 0006 — Hermes fixado, privado e validado com fixture

Data: 02/10/2026. Decisão: usar o Hermes upstream por API privada, fixado no commit `4e3fcd5cd7e40c37cb6f9a21a76fc57a7361957a` de [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent/tree/4e3fcd5cd7e40c37cb6f9a21a76fc57a7361957a). `LICENSE` dessa árvore declara MIT. Python operacional 3.14.7; o `requires-python >=3.11` existe para compatibilidade do updater e não significa suporte operacional a 3.12 (comentário explícito do upstream).

## Evidência e limites

Dois gateways upstream reais, homes/workspaces/XDG state privados, autenticação por runtime e provider HTTP sintético local. Doze checks passaram; ver [evidência](../evidence/F00-hermes.md). Gateway não recebe chaves externas. Fixture retorna texto marcado `SYNTHETIC_FIXTURE`; seleção `fixture-a/b` testa transporte, não qualidade ou faturamento de modelos.

API observada: `/v1/capabilities`, `/v1/toolsets`, `/v1/responses`, `/v1/chat/completions`, `/v1/runs`, `/v1/runs/{id}`, `/v1/runs/{id}/stop`. Outros endpoints anunciados em capabilities não foram todos exercitados. Memória nativa/profile injection e toolsets estão desligados na configuração do experimento.

Adotar um home por `(owner,agent)` e um processo ativo por home; identidade da aplicação nunca é um ID aceito do cliente. O adaptador deve impedir acesso público à API Hermes e expor somente operações traduzidas/autorizadas. O token upstream permite funções adicionais; nunca o dar ao navegador. As APIs de skills/steer/approval não concedem automaticamente autoridade do produto.

Processos do spike usam o mesmo usuário do sistema: esse teste comprova separação lógica de estado, não isolamento contra código hostil. F05 requer containers/volumes e rede restritos, lease/fencing, testes de queda durante execução e broker de ferramentas. Não habilitar terminal/browser/cron por existir endpoint upstream.

## Adaptação requerida antes de F05

- Persistir IDs/mapeamentos/receipts na aplicação e traduzir frames permitidos; remover reasoning e metadados privados.
- Idempotência upstream anuncia retenção de 24 h; a aplicação preserva sua própria política mais longa e reconciliação.
- Testar replay de `/runs/{id}/events`, falha durante run ativo e validade de lease; SSE de chat completo não comprova essas propriedades.
- Tools continuam desabilitadas até verificar interceptação/broker e tentativa adversarial. Ausência de schemas na fixture não prova sandbox/egress.
- PostgreSQL será memória canônica. Testar invalidação de sessões ao esquecer; flags de memória nativa do spike não implementam esquecimento do produto.
- Homologar fornecedor/modelo quando houver conexão autorizada. Sem suporte confirmado, capability fica indisponível.

Alternativa LangGraph permanece comparador, sem instalação de um segundo motor. Isolamento ou API insuficiente exigirão adaptar/suspender a funcionalidade, não compartilhar home para contornar.
