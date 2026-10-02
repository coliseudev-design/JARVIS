#!/usr/bin/env bash
set -euo pipefail
task_cache=/workspace/.cache/jarvis
task_commit=4e3fcd5cd7e40c37cb6f9a21a76fc57a7361957a
mkdir -p "$task_cache"
export UV_CACHE_DIR=/workspace/.cache/uv
export UV_PYTHON_INSTALL_DIR="$task_cache/python"
export UV_PROJECT_ENVIRONMENT="$task_cache/hermes-venv"
if [ ! -d "$task_cache/hermes-upstream/.git" ]; then
  git clone --no-checkout https://github.com/NousResearch/hermes-agent.git "$task_cache/hermes-upstream"
  git -C "$task_cache/hermes-upstream" checkout --detach "$task_commit"
fi
test "$(git -C "$task_cache/hermes-upstream" rev-parse HEAD)" = "$task_commit" || { echo 'Unexpected upstream commit; preserve checkout and inspect.' >&2; exit 1; }
test -z "$(git -C "$task_cache/hermes-upstream" status --porcelain --untracked-files=no)" || { echo 'Upstream tracked files changed; inspect before installing.' >&2; exit 1; }
uv python install --no-bin 3.14.7
# Upstream api_server imports aiohttp but has no dedicated API extra.
# The pinned homeassistant extra contains only aiohttp; this installs its HTTP
# dependency closure and does NOT enable a Home Assistant tool or connection.
uv sync --project "$task_cache/hermes-upstream" --frozen --no-dev --extra homeassistant --python 3.14.7
"$task_cache/hermes-venv/bin/python" --version
