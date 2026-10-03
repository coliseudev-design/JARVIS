#!/usr/bin/env bash
set -euo pipefail
# Use hexadecimal secrets so the same credentials can safely form database URLs.
for name in JARVIS_API_PASSWORD JARVIS_WORKER_PASSWORD JARVIS_MIGRATOR_PASSWORD JARVIS_AUTH_PASSWORD; do
  [[ ${!name} =~ ^[a-fA-F0-9]{48,128}$ ]] || { echo "$name must contain 48-128 hexadecimal characters" >&2; exit 1; }
done
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=api_password="$JARVIS_API_PASSWORD" --set=worker_password="$JARVIS_WORKER_PASSWORD" --set=migrator_password="$JARVIS_MIGRATOR_PASSWORD" --set=auth_password="$JARVIS_AUTH_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE jarvis_owner NOLOGIN' WHERE NOT EXISTS(SELECT FROM pg_roles WHERE rolname='jarvis_owner') \gexec
SELECT 'CREATE ROLE jarvis_api LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE' WHERE NOT EXISTS(SELECT FROM pg_roles WHERE rolname='jarvis_api') \gexec
SELECT 'CREATE ROLE jarvis_worker LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE' WHERE NOT EXISTS(SELECT FROM pg_roles WHERE rolname='jarvis_worker') \gexec
SELECT 'CREATE ROLE jarvis_migrator LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE' WHERE NOT EXISTS(SELECT FROM pg_roles WHERE rolname='jarvis_migrator') \gexec
SELECT 'CREATE ROLE jarvis_auth LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE' WHERE NOT EXISTS(SELECT FROM pg_roles WHERE rolname='jarvis_auth') \gexec
SELECT format('ALTER ROLE jarvis_api PASSWORD %L', :'api_password') \gexec
SELECT format('ALTER ROLE jarvis_worker PASSWORD %L', :'worker_password') \gexec
SELECT format('ALTER ROLE jarvis_migrator PASSWORD %L', :'migrator_password') \gexec
SELECT format('ALTER ROLE jarvis_auth PASSWORD %L', :'auth_password') \gexec
GRANT jarvis_owner TO jarvis_migrator;
ALTER DATABASE jarvis_dev OWNER TO jarvis_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE EXTENSION IF NOT EXISTS vector;
ALTER EXTENSION vector UPDATE;
SQL
