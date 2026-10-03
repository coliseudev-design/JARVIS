// Pipe into the API container only in a disposable Compose project.
import { createAuth } from './apps/api/dist/auth/store.js';
import { randomUUID } from 'node:crypto';
import { readFile, stat, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
if (process.env.F02_ISOLATED_DATABASE !== '1') throw new Error('Disposable database required');
const auth = await createAuth({ databaseUrl: process.env.AUTH_DATABASE_URL, profileDatabaseUrl: process.env.DATABASE_URL, masterKey: process.env.APP_ENCRYPTION_KEY, origin: process.env.PUBLIC_ORIGIN, mailboxPath: process.env.MAILBOX_PATH });
const base = 'http://web:8080', origin = process.env.PUBLIC_ORIGIN;
const password = 'SYNTHETIC-compose-fixture-2026';
async function call(route, method = 'GET', payload, session) {
  const headers = { origin };
  if (payload) headers['content-type'] = 'application/json';
  if (session) { headers.cookie = session.cookie; headers['x-csrf-token'] = session.me.csrf_token; }
  return fetch(base + route, { method, headers, body: payload ? JSON.stringify(payload) : undefined });
}
try {
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/health/ready')).status, 200);
  const tenant = randomUUID();
  await auth.pool.query('INSERT INTO jarvis_auth.tenants(id,name) VALUES($1,$2)', [tenant, 'Container synthetic R/M']);
  const users = [];
  for (const name of ['R', 'M']) {
    const invite = await auth.invite(tenant, `${name.toLowerCase()}-${randomUUID()}@synthetic.invalid`, 'member');
    assert.equal((await stat(invite.filename)).mode & 0o777, 0o600);
    const token = new URL(JSON.parse(await readFile(invite.filename, 'utf8')).link).hash.split('=')[1];
    const result = await call('/api/v1/auth/invitations/accept', 'POST', { token, password, display_name: 'CONTAINER_PRIVATE_' + name });
    assert.equal(result.status, 201);
    const header = result.headers.get('set-cookie');
    assert(header.includes('__Host-jarvis_session=') && header.includes('; Secure') && header.includes('; HttpOnly'));
    const user = { cookie: header.split(';')[0], me: {} };
    user.me = await (await call('/api/v1/me', 'GET', undefined, user)).json();
    users.push(user);
  }
  assert.equal((await call('/api/v1/profiles/' + users[0].me.profile.id, 'GET', undefined, users[1])).status, 404);
  assert.equal((await call('/api/v1/auth/logout', 'POST', {}, users[0])).status, 204);
  assert.equal((await call('/api/v1/me', 'GET', undefined, users[0])).status, 401);
  await assert.rejects(access('/run/secrets/npm_ca'));
  console.log('Container proxy, mailbox permissions, invitation, Secure cookie, isolation and logout passed; build CA absent in runtime.');
} finally { await auth.close(); }
