#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'if(process.versions.node.split(".")[0]!=="24")process.exit(1)'
export npm_config_cache=${npm_config_cache:-/workspace/.cache/npm}
npm ci --ignore-scripts --no-audit --no-fund
if [ ! -x /workspace/.local/jarvis-system/usr/lib/postgresql/17/bin/postgres ]; then
  bash scripts/install-native.sh
fi
python3 scripts/local-services.py
npm run build
bash scripts/with-dev-env.sh npm run db:migrate
bash scripts/install-hermes-spike.sh
