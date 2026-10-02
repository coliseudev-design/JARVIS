#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f .local/dev.env || { echo 'Run python3 scripts/local-services.py first.' >&2; exit 1; }
set -a
source .local/dev.env
set +a
exec "$@"
