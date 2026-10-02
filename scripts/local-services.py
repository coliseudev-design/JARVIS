#!/usr/bin/env python3
"""Private disposable development services, using workspace Debian binaries."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local'
SYSTEM = Path(os.environ.get('JARVIS_SYSTEM_ROOT', '/workspace/.local/jarvis-system'))
PG = SYSTEM / 'usr/lib/postgresql/17/bin'
DATA = LOCAL / 'pgdata'
SOCKET = LOCAL / 'sockets'

def run(args, **kw):
    return subprocess.run([str(x) for x in args], check=True, **kw)

def main():
    os.umask(0o077)
    LOCAL.mkdir(exist_ok=True, mode=0o700)
    SOCKET.mkdir(exist_ok=True, mode=0o700)
    if len(sys.argv) > 1 and sys.argv[1] == 'stop':
        subprocess.run([str(PG/'pg_ctl'), '-D', str(DATA), '-m', 'fast', 'stop'], check=False)
        pidfile = LOCAL / 'redis.pid'
        if pidfile.exists():
            import signal
            pid = int(pidfile.read_text())
            # Refuse to signal a reused PID unless it is our configured Redis process.
            cmdline = Path(f'/proc/{pid}/cmdline')
            if cmdline.exists() and 'redis-server' in cmdline.read_bytes().decode() and '56379' in cmdline.read_bytes().decode():
                os.kill(pid, signal.SIGTERM)
        return
    if not (PG/'postgres').exists():
        raise SystemExit('Native dependencies missing; run bash scripts/install-native.sh')
    config_path = LOCAL / 'services.json'
    if not config_path.exists():
        config_path.write_text(json.dumps({name: secrets.token_hex(24) for name in ('api', 'worker', 'migrator', 'redis')}))
    keys = json.loads(config_path.read_text())
    if not (DATA/'PG_VERSION').exists():
        run([PG/'initdb', '-D', DATA, '-U', 'jarvis_bootstrap', '--auth-local=trust', '--auth-host=scram-sha-256', '--no-locale', '--encoding=UTF8'], stdout=subprocess.DEVNULL)
    if subprocess.run([str(PG/'pg_ctl'), '-D', str(DATA), 'status'], stdout=subprocess.DEVNULL).returncode:
        run([PG/'pg_ctl', '-D', DATA, '-l', LOCAL/'postgres.log', '-o', f'-p 55432 -h 127.0.0.1 -k {SOCKET}', '-w', 'start'], stdout=subprocess.DEVNULL)
    sql = r"""SELECT 'CREATE ROLE jarvis_owner NOLOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='jarvis_owner')\gexec
"""
    for role in ('api', 'worker', 'migrator'):
        sql += f"SELECT 'CREATE ROLE jarvis_{role} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD ''{keys[role]}''' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='jarvis_{role}')\\gexec\n"
    sql += "GRANT jarvis_owner TO jarvis_migrator;\n"
    sql += "SELECT 'CREATE DATABASE jarvis_dev OWNER jarvis_owner' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='jarvis_dev')\\gexec\n"
    command = [PG/'psql', '-h', SOCKET, '-p', '55432', '-U', 'jarvis_bootstrap', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
    run(command, input=sql, text=True, stdout=subprocess.DEVNULL)
    command[command.index('postgres')] = 'jarvis_dev'
    run(command, input='CREATE EXTENSION IF NOT EXISTS vector; REVOKE CREATE ON SCHEMA public FROM PUBLIC;', text=True, stdout=subprocess.DEVNULL)
    redis_cfg = LOCAL/'redis.conf'
    redis_cfg.write_text(f'bind 127.0.0.1\nport 56379\nprotected-mode yes\nrequirepass {keys["redis"]}\ndaemonize yes\npidfile {LOCAL}/redis.pid\nlogfile {LOCAL}/redis.log\ndir {LOCAL}\nappendonly yes\n')
    service_env = dict(os.environ, LD_LIBRARY_PATH=str(SYSTEM/'usr/lib/x86_64-linux-gnu'), REDISCLI_AUTH=keys['redis'])
    cli = SYSTEM/'usr/bin/redis-cli'
    ping = subprocess.run([str(cli), '-p', '56379', 'ping'], env=service_env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    if ping.returncode or ping.stdout.strip() != 'PONG':
        run([SYSTEM/'usr/bin/redis-server', redis_cfg], env=service_env)
        result = run([cli, '-p', '56379', 'ping'], env=service_env, stdout=subprocess.PIPE, text=True)
        if result.stdout.strip() != 'PONG': raise RuntimeError('REDIS_NOT_READY')
    env = ['APP_MODE=development', 'HOST=127.0.0.1', 'PORT=3001']
    for var, role in [('DATABASE_URL','api'), ('WORKER_DATABASE_URL','worker'), ('MIGRATION_DATABASE_URL','migrator')]:
        env.append(f'{var}=postgresql://jarvis_{role}:{keys[role]}@127.0.0.1:55432/jarvis_dev')
    env.append(f'REDIS_URL=redis://:{keys["redis"]}@127.0.0.1:56379')
    (LOCAL/'dev.env').write_text('\n'.join(env)+'\n')
    print('Private PostgreSQL/pgvector and Redis ready; configuration stored in .local/dev.env (mode 0600).')

if __name__ == '__main__': main()
