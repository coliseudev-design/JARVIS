#!/usr/bin/env python3
"""Real pinned Hermes processes; synthetic loopback model, no live inference."""
import concurrent.futures
import http.server
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

COMMIT = '4e3fcd5cd7e40c37cb6f9a21a76fc57a7361957a'
CACHE = Path('/workspace/.cache/jarvis')
UPSTREAM = CACHE / 'hermes-upstream'
PYTHON = CACHE / 'hermes-venv/bin/python'
RECORDS = []


def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class Fixture(http.server.BaseHTTPRequestHandler):
    """Deterministic model protocol fixture; outputs explicitly identify simulation."""
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'object': 'list', 'data': [{'id': 'fixture-a', 'object': 'model'}, {'id': 'fixture-b', 'object': 'model'}]}).encode())

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if not self.path.endswith('/chat/completions'):
            self.send_response(404); self.end_headers(); return
        RECORDS.append(body)
        content = json.dumps(body.get('messages', []))
        users = [m.get('content', '') for m in body.get('messages', []) if m['role'] == 'user']
        last = str(users[-1]) if users else ''
        markers = [x for x in ('CANARY_R_92', 'CANARY_M_47') if x in content]
        result = 'SYNTHETIC_FIXTURE ' + body.get('model', '') + ' ' + ','.join(markers)
        stream = bool(body.get('stream'))
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream' if stream else 'application/json')
        self.end_headers()
        try:
            if stream:
                for token in result.split(' '):
                    data = {'id': 'chatcmpl-fixture', 'object': 'chat.completion.chunk', 'created': 1, 'model': body['model'], 'choices': [{'index': 0, 'delta': {'content': token + ' '}, 'finish_reason': None}]}
                    self.wfile.write(('data: ' + json.dumps(data) + '\n\n').encode()); self.wfile.flush()
                    time.sleep(0.03)
                if 'SLOW_FIXTURE' in last:
                    time.sleep(4)
                data = {'id': 'chatcmpl-fixture', 'object': 'chat.completion.chunk', 'created': 1, 'model': body['model'], 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}], 'usage': {'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15}}
                self.wfile.write(('data: ' + json.dumps(data) + '\n\ndata: [DONE]\n\n').encode())
            else:
                self.wfile.write(json.dumps({'id': 'chatcmpl-fixture', 'object': 'chat.completion', 'created': 1, 'model': body['model'], 'choices': [{'index': 0, 'message': {'role': 'assistant', 'content': result}, 'finish_reason': 'stop'}], 'usage': {'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15}}).encode())
        except (BrokenPipeError, ConnectionResetError):
            pass


class Runtime:
    def __init__(self, root, label, fixture_port):
        self.home = root / label
        self.home.mkdir(mode=0o700)
        self.work = self.home / 'workspace'; self.work.mkdir()
        self.port = port()
        # Local transport authentication only; generated for this test, never printed.
        import secrets
        self.key = secrets.token_urlsafe(32)
        cfg = {'model': {'default': 'fixture-a', 'provider': 'custom', 'base_url': f'http://127.0.0.1:{fixture_port}/v1', 'context_length': 65536}, 'platform_toolsets': {'api_server': [], 'cli': []}, 'memory': {'memory_enabled': False, 'user_profile_enabled': False}, 'skills': {'creation_nudge_interval': 0}, 'agent': {'max_iterations': 2}, 'gateway': {'api_server': {'enabled': True, 'host': '127.0.0.1', 'port': self.port, 'max_concurrent_runs': 1, 'direct_model_requests': True}}, 'display': {'interim_assistant_messages': False}, 'mcp_servers': {}}
        # JSON is a YAML subset; avoids a helper dependency.
        (self.home / 'config.yaml').write_text(json.dumps(cfg))
        self.env = {k: v for k, v in os.environ.items() if k in ('PATH', 'LANG', 'LC_ALL', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY')}
        self.env.update({'HERMES_HOME': str(self.home), 'API_SERVER_KEY': self.key, 'OPENAI_API_KEY': 'synthetic-local-fixture-only', 'OPENAI_BASE_URL': f'http://127.0.0.1:{fixture_port}/v1', 'NO_PROXY': '127.0.0.1,localhost', 'PYTHONDONTWRITEBYTECODE': '1'})
        self.env['XDG_STATE_HOME'] = str(self.home / 'state')
        (self.home / 'memories').mkdir()
        for filename in ('MEMORY.md', 'USER.md'):
            (self.home / 'memories' / filename).write_text('NATIVE_DISABLED_' + label)
        self.proc = None

    def start(self):
        self.log = (self.home / 'gateway.log').open('ab')
        self.proc = subprocess.Popen([str(PYTHON), str(UPSTREAM / 'hermes'), 'gateway', 'run'], cwd=self.work, env=self.env, stdout=self.log, stderr=subprocess.STDOUT, start_new_session=True)
        deadline = time.monotonic() + 70
        while time.monotonic() < deadline:
            if self.proc.poll() is not None:
                raise RuntimeError(f'Gateway exited; inspect {self.home}/gateway.log')
            try:
                if self.request('/health')[0] == 200:
                    return
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(0.25)
        raise RuntimeError(f'Gateway readiness timeout; inspect {self.home}/gateway.log')

    def stop(self):
        if self.proc and self.proc.poll() is None:
            os.killpg(self.proc.pid, signal.SIGTERM)
            try:
                self.proc.wait(timeout=12)
            except subprocess.TimeoutExpired:
                os.killpg(self.proc.pid, signal.SIGKILL); self.proc.wait()
        if hasattr(self, 'log'):
            self.log.close()

    def request(self, path, body=None, key=None, raw=False, headers=None):
        h = {'Authorization': 'Bearer ' + (self.key if key is None else key), 'Content-Type': 'application/json'}
        h.update(headers or {})
        req = urllib.request.Request(f'http://127.0.0.1:{self.port}' + path, data=None if body is None else json.dumps(body).encode(), headers=h)
        try:
            with urllib.request.urlopen(req, timeout=50) as resp:
                data = resp.read().decode()
                return resp.status, data if raw else json.loads(data)
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read().decode()

    def completed(self, run_id):
        for _ in range(100):
            status, data = self.request('/v1/runs/' + run_id)
            assert status == 200, (status, data)
            if data['status'] in ('completed', 'failed', 'cancelled', 'interrupted'):
                return data
            time.sleep(.1)
        raise AssertionError('Run did not settle')


def main():
    assert subprocess.check_output(['git', '-C', str(UPSTREAM), 'rev-parse', 'HEAD'], text=True).strip() == COMMIT
    root = Path(tempfile.mkdtemp(prefix='hermes-spike-', dir=CACHE)); os.chmod(root, 0o700)
    fixture = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
    threading.Thread(target=fixture.serve_forever, daemon=True).start()
    runtimes = [Runtime(root, label, fixture.server_port) for label in ('r', 'm')]
    results = {'mode': 'real-hermes-with-synthetic-local-provider', 'commit': COMMIT, 'python': subprocess.check_output([str(PYTHON), '--version'], text=True).strip(), 'checks': {}}
    try:
        for runtime in runtimes:
            runtime.start()
        r, m = runtimes
        checks = results['checks']
        checks['two_private_homes_processes'] = r.proc.pid != m.proc.pid and r.home != m.home
        code, capabilities = r.request('/v1/capabilities'); assert code == 200
        results['capabilities'] = capabilities
        assert r.request('/v1/capabilities', key=m.key)[0] == 401
        checks['cross_runtime_credential_rejected'] = True
        code, toolsets = r.request('/v1/toolsets'); assert code == 200
        results['toolsets'] = toolsets
        with concurrent.futures.ThreadPoolExecutor() as pool:
            responses = list(pool.map(lambda x: x[0].request('/v1/responses', {'input': x[1], 'model': 'fixture-a', 'provider': 'custom'}), [(r, 'CANARY_R_92'), (m, 'CANARY_M_47')]))
        for code, response in responses:
            assert code == 200, response
        rr, mm = [item[1] for item in responses]
        assert 'CANARY_R_92' in json.dumps(rr) and 'CANARY_M_47' not in json.dumps(rr)
        assert 'CANARY_M_47' in json.dumps(mm) and 'CANARY_R_92' not in json.dumps(mm)
        checks['concurrent_canaries_isolated'] = True
        assert m.request('/v1/responses/' + rr['id'])[0] == 404
        checks['cross_home_response_id_rejected'] = True
        r.stop(); r.start()
        code, resumed = r.request('/v1/responses', {'input': 'Recall', 'previous_response_id': rr['id'], 'model': 'fixture-b', 'provider': 'custom'})
        assert code == 200 and 'CANARY_R_92' in json.dumps(resumed), resumed
        assert 'fixture-b' in json.dumps(resumed)
        checks['continuity_after_process_restart_and_model_switch'] = True
        code, sse = m.request('/v1/chat/completions', {'messages': [{'role': 'user', 'content': 'Stream fixture'}], 'model': 'fixture-b', 'provider': 'custom', 'stream': True}, raw=True)
        assert code == 200 and 'data:' in sse and '[DONE]' in sse and 'SYNTHETIC_FIXTURE' in sse
        checks['real_sse_transport'] = True
        payload = {'input': 'SLOW_FIXTURE', 'model': 'fixture-a', 'provider': 'custom'}
        code, run = r.request('/v1/runs', payload, headers={'Idempotency-Key': 'synthetic-cancel-run'})
        assert code == 202, run
        run_id = run['run_id']
        _, replay = r.request('/v1/runs', payload, headers={'Idempotency-Key': 'synthetic-cancel-run'})
        assert replay['run_id'] == run_id
        checks['run_idempotency'] = True
        assert m.request('/v1/runs/' + run_id)[0] == 404
        checks['cross_home_run_id_rejected'] = True
        time.sleep(.5)
        code, stop = r.request('/v1/runs/' + run_id + '/stop', {})
        assert code == 200, stop
        settled = r.completed(run_id)
        assert settled['status'] == 'cancelled', settled
        checks['cancel_settles_after_worker_exit'] = True
        checks['no_tools_sent_to_provider'] = all(not b.get('tools') for b in RECORDS)
        assert checks['no_tools_sent_to_provider']
        assert all('CANARY_R_92' not in json.dumps(b) or 'CANARY_M_47' not in json.dumps(b) for b in RECORDS)
        checks['provider_requests_never_mix_canaries'] = True
        assert all('NATIVE_DISABLED_' not in json.dumps(b) for b in RECORDS)
        assert all((runtime.home / 'memories' / name).read_text() == 'NATIVE_DISABLED_' + runtime.home.name for runtime in runtimes for name in ('MEMORY.md', 'USER.md'))
        checks['native_memory_not_in_prompt_and_seed_unchanged'] = True
        results['provider_request_count'] = len(RECORDS)
        results['model_ids_observed_by_fixture'] = sorted({b.get('model') for b in RECORDS})
        results['fixture_usage_not_real_billing'] = True
        results['status'] = 'passed'
    finally:
        for runtime in runtimes:
            runtime.stop()
        fixture.shutdown()
        (root / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
        print(json.dumps({'results_path': str(root / 'results.json'), 'status': results.get('status', 'failed'), 'checks': results['checks']}, indent=2))


if __name__ == '__main__':
    main()
