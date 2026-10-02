# Reproduzir o spike Hermes F00

No ambiente cloud Debian, a partir de `/workspace/JARVIS`:

```bash
bash scripts/install-hermes-spike.sh
python3 services/hermes-adapter/spike/run_spike.py
```

Requer Git HTTPS, uv, downloads Python/PyPI e acesso ao upstream GitHub. O script fixa commit e Python e usa `uv sync --frozen --no-dev --extra homeassistant`; não resolve versões novas nem altera lockfile upstream. Esse extra upstream contém somente aiohttp, necessário ao API server, que não tem extra próprio; não habilita ferramenta/conexão Home Assistant. Cache e venv ficam fora do produto. Não criar worktree: o checkout cloud já é isolado.

O spike cria dois homes temporários privados, usa apenas um provider local de teste, inicia gateways upstream, valida doze checks e encerra os processos que criou. Imprime somente caminho do resultado e flags booleanas. Segredos efêmeros de transporte local não são retornados. Logs e estado sintéticos permanecem no cache privado para diagnóstico; não publicar arquivos de home/config.

Depois de publicar/restaurar o ambiente, processos não sobrevivem ao snapshot. Reexecutar o spike quando necessário; ele não é o serviço Hermes do produto nem faz parte do Compose F01. A integração de runtime em containers começa em F05 com os gates do ADR 0006.
