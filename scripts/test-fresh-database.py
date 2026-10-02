#!/usr/bin/env python3
"""Validate the actual Compose bootstrap SQL and migrations on a disposable cluster."""
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
pg = Path(os.environ.get('JARVIS_SYSTEM_ROOT', '/workspace/.local/jarvis-system')) / 'usr/lib/postgresql/17/bin'
os.umask(0o077)
scratch = Path(tempfile.mkdtemp(prefix='fresh-db-', dir=root/'.local'))
sock = scratch/'socket'; sock.mkdir()
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 0)); port = probe.getsockname()[1]
def run(args, **kw):
    return subprocess.run([str(x) for x in args], check=True, **kw)
started = False
try:
    run([pg/'initdb', '-D', scratch/'data', '-U', 'jarvis_bootstrap', '--auth-local=trust', '--auth-host=scram-sha-256', '--no-locale', '--encoding=UTF8'], stdout=subprocess.DEVNULL)
    run([pg/'pg_ctl', '-D', scratch/'data', '-l', scratch/'postgres.log', '-o', f'-p {port} -h 127.0.0.1 -k {sock}', '-w', 'start'], stdout=subprocess.DEVNULL); started = True
    env = dict(os.environ, PATH=f'{pg}:'+os.environ['PATH'], PGHOST=str(sock), PGPORT=str(port), PGUSER='jarvis_bootstrap', POSTGRES_USER='jarvis_bootstrap', POSTGRES_DB='jarvis_dev')
    for name in ('JARVIS_API_PASSWORD', 'JARVIS_WORKER_PASSWORD', 'JARVIS_MIGRATOR_PASSWORD'): env[name] = secrets.token_hex(32)
    run([pg/'createdb', 'jarvis_dev'], env=env)
    run(['bash', root/'infra/compose/init-db.sh'], env=env, stdout=subprocess.DEVNULL)
    env.update(APP_MODE='development', MIGRATION_DATABASE_URL=f'postgresql://jarvis_migrator:{env["JARVIS_MIGRATOR_PASSWORD"]}@127.0.0.1:{port}/jarvis_dev')
    for _ in range(2): run(['node', 'packages/database/dist/migrate.js'], cwd=root, env=env)
    result = run([pg/'psql', '-d', 'jarvis_dev', '-Atc', "SELECT count(*) FROM jarvis.schema_migrations WHERE version=1"], env=env, stdout=subprocess.PIPE, text=True)
    assert result.stdout.strip() == '1'
    print('Fresh database: Compose bootstrap + extension + migration + repeat passed.')
finally:
    if started: run([pg/'pg_ctl', '-D', scratch/'data', '-m', 'fast', '-w', 'stop'], stdout=subprocess.DEVNULL)
    shutil.rmtree(scratch)
