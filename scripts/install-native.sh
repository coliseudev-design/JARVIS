#!/usr/bin/env bash
set -euo pipefail
# Debian 13 cloud fallback when image registries are unavailable; no root needed.
test "$(. /etc/os-release; echo "$VERSION_CODENAME")" = trixie
task_apt=/workspace/.cache/jarvis-apt
task_system=${JARVIS_SYSTEM_ROOT:-/workspace/.local/jarvis-system}
mkdir -p "$task_apt"/{lists/partial,cache/archives/partial,empty,debs} "$task_system"
cat > "$task_apt/sources.list" <<'EOF'
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main
EOF
apt_args=(-o "Dir::Etc::parts=$task_apt/empty" -o "Dir::Etc::sourcelist=$task_apt/sources.list" -o "Dir::Etc::sourceparts=$task_apt/empty" -o "Dir::State::lists=$task_apt/lists" -o "Dir::Cache=$task_apt/cache" -o Acquire::Retries=0)
apt-get "${apt_args[@]}" update
cd "$task_apt/debs"
apt-get "${apt_args[@]}" download postgresql-17=17.11-0+deb13u1 postgresql-client-17=17.11-0+deb13u1 postgresql-17-pgvector=0.8.0-1 redis-server=5:8.0.2-3+deb13u2 redis-tools=5:8.0.2-3+deb13u2 libpq5=17.11-0+deb13u1 libllvm19=1:19.1.7-3+b1 libicu76=76.1-4 liblzf1=3.6-4+b3 libjemalloc2=5.3.0-3
for package in ./*.deb; do dpkg-deb -x "$package" "$task_system"; done
"$task_system/usr/lib/postgresql/17/bin/postgres" --version
LD_LIBRARY_PATH="$task_system/usr/lib/x86_64-linux-gnu" "$task_system/usr/bin/redis-server" --version
