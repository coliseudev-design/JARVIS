import type pg from 'pg';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPool } from '@jarvis/database';
import { AppError, unauthorized, invalid, missing } from '../errors.js';
import { hashPassword, verifyPassword, randomToken, digest, csrfFor, encryptSeed, decryptSeed, validTotp, base32 } from './crypto.js';

export type Actor = { userId: string; tenantId: string; sessionId: string; tokenHash: string; email: string; role: 'member'|'tenant_admin'; platformAdmin: boolean; mfaVerified: boolean; mfaEnabled: boolean };
export type AuthOptions = { databaseUrl: string; profileDatabaseUrl: string; masterKey: string; origin: string; mailboxPath: string; now?: () => number };
export async function scoped<T>(pool: pg.Pool, actor: Pick<Actor,'tenantId'|'userId'>, action: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id',$1,true), set_config('app.user_id',$2,true)", [actor.tenantId, actor.userId]);
    const result = await action(client); await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function createAuth(options: AuthOptions) {
  if (!/^[a-f0-9]{64}$/i.test(options.masterKey)) throw new Error('INVALID_MASTER_KEY');
  const pool = createPool(options.databaseUrl), profiles = createPool(options.profileDatabaseUrl);
  const now = options.now ?? Date.now;
  const dummyHash = await hashPassword(randomToken());
  const key = options.masterKey;
  async function tx<T>(action: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try { await c.query('BEGIN'); const value = await action(c); await c.query('COMMIT'); return value; }
    catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  const audit = (c: pg.PoolClient, op: string, actor?: {userId:string;tenantId:string}) => c.query('INSERT INTO jarvis_auth.audit_events(id,actor_user_id,tenant_id,operation) VALUES($1,$2,$3,$4)', [randomUUID(), actor?.userId ?? null, actor?.tenantId ?? null, op]);
  async function mail(email: string, kind: 'invite'|'recovery', token: string) {
    await mkdir(options.mailboxPath, { recursive: true, mode: 0o700 });
    const filename = path.join(options.mailboxPath, randomUUID()+'.json');
    await writeFile(filename, JSON.stringify({ delivery: 'local_test_mailbox', to: email, kind, link: `${options.origin}/#${kind}=${token}` }), { mode: 0o600, flag: 'wx' });
    return filename;
  }
  async function issueSession(c: pg.PoolClient, userId: string, tenantId: string, mfa: boolean) {
    const token = randomToken(), id = randomUUID();
    await c.query('INSERT INTO jarvis_auth.sessions(id,token_hash,user_id,tenant_id,mfa_verified,expires_at) VALUES($1,$2,$3,$4,$5,$6)', [id,digest(token),userId,tenantId,mfa,new Date(now()+12*3600_000)]);
    await audit(c,'session.created',{userId,tenantId}); return token;
  }
  async function rateLimit(keyText: string, limit = 10) {
    const value = await pool.query(`INSERT INTO jarvis_auth.rate_limits(key_hash,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes')
      ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN jarvis_auth.rate_limits.expires_at<now() THEN 1 ELSE jarvis_auth.rate_limits.attempts+1 END,
      expires_at=CASE WHEN jarvis_auth.rate_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE jarvis_auth.rate_limits.expires_at END RETURNING attempts`, [digest(keyText)]);
    if (value.rows[0].attempts > limit) throw new AppError(429,'RATE_LIMITED','Muitas tentativas. Tente novamente mais tarde.');
  }
  async function authenticate(token: string | undefined): Promise<Actor> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw unauthorized();
    const found = await pool.query(`SELECT s.id, s.token_hash, s.user_id, s.tenant_id, s.mfa_verified, u.email, u.platform_admin, m.role,
      (f.active_ciphertext IS NOT NULL) AS mfa_enabled
      FROM jarvis_auth.sessions s JOIN jarvis_auth.users u ON u.id=s.user_id
      JOIN jarvis_auth.memberships m ON (m.tenant_id,m.user_id)=(s.tenant_id,s.user_id)
      LEFT JOIN jarvis_auth.mfa_factors f ON f.user_id=u.id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.enabled AND m.active`, [digest(token)]);
    const row = found.rows[0]; if (!row) throw unauthorized();
    return { userId:row.user_id, tenantId:row.tenant_id, sessionId:row.id, tokenHash:row.token_hash, email:row.email, role:row.role, platformAdmin:row.platform_admin, mfaVerified:row.mfa_verified, mfaEnabled:row.mfa_enabled };
  }
  async function profile(actor: Actor, id?: string) {
    return scoped(profiles, actor, async c => {
      const value = id ? await c.query('SELECT id,display_name,timezone,version FROM jarvis.user_profiles WHERE id=$1', [id]) : await c.query('SELECT id,display_name,timezone,version FROM jarvis.user_profiles');
      if (!value.rows[0]) throw missing(); return value.rows[0] as {id:string;display_name:string;timezone:string;version:number};
    });
  }
  function requireAdmin(actor: Actor) {
    if (actor.role !== 'tenant_admin' && !actor.platformAdmin) throw new AppError(403,'FORBIDDEN','Operação não permitida.');
    if (!actor.mfaEnabled || !actor.mfaVerified) throw new AppError(403,'MFA_REQUIRED','Ative e valide o segundo fator antes de administrar convites.');
  }
  async function invite(tenantId: string, email: string, role: 'member'|'tenant_admin') {
    const token = randomToken(), id = randomUUID();
    await pool.query('INSERT INTO jarvis_auth.invitations(id,token_hash,tenant_id,email,role,expires_at) VALUES($1,$2,$3,$4,$5,$6)', [id,digest(token),tenantId,email.trim().toLowerCase(),role,new Date(now()+24*3600_000)]);
    try { const filename = await mail(email,'invite',token); return { id, filename }; }
    catch (error) { await pool.query('DELETE FROM jarvis_auth.invitations WHERE id=$1',[id]); throw error; }
  }
  async function accept(token: string, password: string, displayName: string) {
    const passwordHash = await hashPassword(password);
    try {
      return await tx(async c => {
        const result = await c.query('SELECT * FROM jarvis_auth.invitations WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',[digest(token)]);
        const inv = result.rows[0]; if (!inv) throw invalid();
        const userId = randomUUID();
        await c.query('INSERT INTO jarvis_auth.users(id,email,password_hash) VALUES($1,$2,$3)',[userId,inv.email,passwordHash]);
        await c.query('INSERT INTO jarvis_auth.memberships(tenant_id,user_id,role) VALUES($1,$2,$3)',[inv.tenant_id,userId,inv.role]);
        await c.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.user_id',$2,true)",[inv.tenant_id,userId]);
        await c.query('INSERT INTO jarvis.user_profiles(id,tenant_id,owner_user_id,display_name) VALUES($1,$2,$3,$4)',[randomUUID(),inv.tenant_id,userId,displayName]);
        await c.query('UPDATE jarvis_auth.invitations SET consumed_at=now() WHERE id=$1',[inv.id]);
        return issueSession(c,userId,inv.tenant_id,false);
      });
    } catch (err) {
      if (err && typeof err==='object' && 'code' in err && err.code==='23505') throw invalid();
      throw err;
    }
  }
  async function login(email: string, password: string, code?: string) {
    const result = await pool.query('SELECT id,password_hash,enabled FROM jarvis_auth.users WHERE email=$1',[email.trim().toLowerCase()]);
    const user = result.rows[0];
    const matches = await verifyPassword(password,user?.password_hash ?? dummyHash);
    if (!user?.enabled || !matches) throw unauthorized();
    return tx(async c => {
      const fresh = (await c.query('SELECT password_hash,enabled FROM jarvis_auth.users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
      if (!fresh?.enabled || fresh.password_hash!==user.password_hash) throw unauthorized();
      const factor = (await c.query('SELECT * FROM jarvis_auth.mfa_factors WHERE user_id=$1 FOR UPDATE',[user.id])).rows[0];
      let verified = false;
      if (factor?.active_ciphertext) {
        const counter = validTotp(decryptSeed(factor.active_ciphertext,key,user.id),code??'',now(),Number(factor.last_counter));
        if (counter===null) throw unauthorized();
        await c.query('UPDATE jarvis_auth.mfa_factors SET last_counter=$2 WHERE user_id=$1',[user.id,counter]); verified=true;
      }
      const membership = (await c.query('SELECT tenant_id FROM jarvis_auth.memberships WHERE user_id=$1 AND active ORDER BY tenant_id LIMIT 1',[user.id])).rows[0];
      if (!membership) throw unauthorized();
      return issueSession(c,user.id,membership.tenant_id,verified);
    });
  }
  async function recoveryRequest(email: string) {
    const user = (await pool.query('SELECT id FROM jarvis_auth.users WHERE email=$1 AND enabled',[email.trim().toLowerCase()])).rows[0];
    if (!user) return;
    const token = randomToken(), id = randomUUID();
    await pool.query('INSERT INTO jarvis_auth.recovery_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)',[id,user.id,digest(token),new Date(now()+30*60_000)]);
    try { await mail(email,'recovery',token); } catch { await pool.query('DELETE FROM jarvis_auth.recovery_tokens WHERE id=$1',[id]); }
  }
  async function recoveryComplete(token: string,password: string,code?: string) {
    const hash = await hashPassword(password);
    await tx(async c => {
      const candidate = (await c.query('SELECT user_id FROM jarvis_auth.recovery_tokens WHERE token_hash=$1',[digest(token)])).rows[0];
      if (!candidate) throw invalid();
      // Serialize per user before locking any token: invalidating all tokens
      // must not wait on another reset that holds a token and awaits this user.
      const enabled=await c.query('SELECT id FROM jarvis_auth.users WHERE id=$1 AND enabled FOR UPDATE',[candidate.user_id]);
      if(!enabled.rowCount)throw invalid();
      const r = (await c.query('SELECT * FROM jarvis_auth.recovery_tokens WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',[digest(token)])).rows[0];
      if (!r) throw invalid();
      const factor = (await c.query('SELECT * FROM jarvis_auth.mfa_factors WHERE user_id=$1 FOR UPDATE',[r.user_id])).rows[0];
      if (factor?.active_ciphertext) {
        const counter=validTotp(decryptSeed(factor.active_ciphertext,key,r.user_id),code??'',now(),Number(factor.last_counter));
        if(counter===null) throw invalid();
        await c.query('UPDATE jarvis_auth.mfa_factors SET last_counter=$2 WHERE user_id=$1',[r.user_id,counter]);
      }
      await c.query('UPDATE jarvis_auth.users SET password_hash=$2 WHERE id=$1',[r.user_id,hash]);
      await c.query('UPDATE jarvis_auth.recovery_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL',[r.user_id]);
      await c.query('UPDATE jarvis_auth.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[r.user_id]);
      await audit(c,'password.recovered');
    });
  }
  async function startMfa(actor: Actor,password: string) {
    const user = (await pool.query('SELECT password_hash FROM jarvis_auth.users WHERE id=$1 AND enabled',[actor.userId])).rows[0];
    if (!user || !await verifyPassword(password,user.password_hash)) throw unauthorized();
    const seed = randomBytes(20), encrypted=encryptSeed(seed,key,actor.userId);
    await tx(async c => {
      const locked=(await c.query('SELECT password_hash,enabled FROM jarvis_auth.users WHERE id=$1 FOR UPDATE',[actor.userId])).rows[0];
      if(!locked?.enabled||locked.password_hash!==user.password_hash)throw unauthorized();
      const current=(await c.query('SELECT active_ciphertext FROM jarvis_auth.mfa_factors WHERE user_id=$1',[actor.userId])).rows[0];
      if(current?.active_ciphertext) throw new AppError(409,'CONFLICT','Segundo fator já ativo.');
      await c.query(`INSERT INTO jarvis_auth.mfa_factors(user_id,pending_ciphertext,pending_expires_at) VALUES($1,$2,$3)
        ON CONFLICT(user_id) DO UPDATE SET pending_ciphertext=excluded.pending_ciphertext,pending_expires_at=excluded.pending_expires_at`,[actor.userId,encrypted,new Date(now()+10*60_000)]);
    });
    const secret=base32(seed);
    return {secret,otpauth_uri:`otpauth://totp/JARVIS:${encodeURIComponent(actor.email)}?secret=${secret}&issuer=JARVIS&algorithm=SHA1&digits=6&period=30`};
  }
  async function confirmMfa(actor: Actor,code: string) {
    await tx(async c => {
      await c.query('SELECT id FROM jarvis_auth.users WHERE id=$1 FOR UPDATE',[actor.userId]);
      const f=(await c.query('SELECT * FROM jarvis_auth.mfa_factors WHERE user_id=$1 AND pending_expires_at>now() FOR UPDATE',[actor.userId])).rows[0];
      if(!f?.pending_ciphertext || f.active_ciphertext) throw invalid();
      const counter=validTotp(decryptSeed(f.pending_ciphertext,key,actor.userId),code,now());
      if(counter===null) throw invalid();
      await c.query('UPDATE jarvis_auth.mfa_factors SET active_ciphertext=pending_ciphertext,pending_ciphertext=NULL,pending_expires_at=NULL,last_counter=$2 WHERE user_id=$1',[actor.userId,counter]);
      await c.query('UPDATE jarvis_auth.sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2',[actor.userId,actor.sessionId]);
      await c.query('UPDATE jarvis_auth.sessions SET mfa_verified=true WHERE id=$1',[actor.sessionId]);
      await audit(c,'mfa.enabled',actor);
    });
  }
  return {
    pool, profiles, rateLimit, authenticate, profile, login, accept, invite, requireAdmin, recoveryRequest, recoveryComplete, startMfa, confirmMfa,
    csrf: (actor: Actor) => csrfFor(actor.tokenHash,key),
    async updateProfile(actor: Actor,input:{display_name:string;timezone:string;expected_version:number}) {
      return scoped(profiles,actor,async c=>{
        const updated=await c.query('UPDATE jarvis.user_profiles SET display_name=$1,timezone=$2,version=version+1 WHERE version=$3 RETURNING id,display_name,timezone,version',[input.display_name,input.timezone,input.expected_version]);
        if(!updated.rowCount) throw new AppError(409,'VERSION_CONFLICT','O perfil foi alterado. Atualize a página.');
        return updated.rows[0];
      });
    },
    async sessions(actor: Actor) { return (await pool.query('SELECT id,created_at,expires_at,(id=$3) AS current FROM jarvis_auth.sessions WHERE user_id=$1 AND tenant_id=$2 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC',[actor.userId,actor.tenantId,actor.sessionId])).rows; },
    async revoke(actor: Actor,id: string) {
      await tx(async c=>{ const result=await c.query('UPDATE jarvis_auth.sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND user_id=$2 AND tenant_id=$3',[id,actor.userId,actor.tenantId]); if(!result.rowCount) throw missing(); await audit(c,'session.revoked',actor); });
    },
    async check() {
      const r=await pool.query("SELECT r.rolsuper,r.rolbypassrls,r.rolname FROM pg_roles r WHERE r.rolname=current_user");
      if(r.rows[0]?.rolname!=='jarvis_auth'||r.rows[0]?.rolsuper||r.rows[0]?.rolbypassrls) throw new Error('UNSAFE_AUTH_ROLE');
      await pool.query('SELECT 1 FROM jarvis_auth.users LIMIT 1');
      const owned=await pool.query("SELECT 1 FROM pg_tables WHERE schemaname IN ('jarvis','jarvis_auth') AND tableowner=current_user");
      if(owned.rowCount) throw new Error('AUTH_ROLE_OWNS_TABLES');
    },
    close:async()=>{await pool.end();await profiles.end();},
  };
}
export type AuthService=Awaited<ReturnType<typeof createAuth>>;
