import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { randomUUID,randomBytes } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { createApp } from '../../apps/api/src/app.js';
import { createAuth,scoped,type Actor,type AuthService } from '../../apps/api/src/auth/store.js';
import { decryptSeed,totp,digest,hashPassword } from '../../apps/api/src/auth/crypto.js';
import { assertDatabaseReady } from '../../packages/database/src/index.js';

if(process.env.F02_ISOLATED_DATABASE!=='1')throw new Error('Use python3 scripts/test-fresh-database.py --identity; never run identity fixtures against persistent databases.');
const origin='http://127.0.0.1:8080',password='SYNTHETIC-fixture-password-2026';
const fixtureNamespace=randomUUID();
const emailFor=(name:string)=>`${name}-${fixtureNamespace}@synthetic.invalid`;
let auth:AuthService,app:Awaited<ReturnType<typeof createApp>>;
let r:{cookie:string;me:any;actor:Actor},m:typeof r,other:typeof r,admin:typeof r;
const profilePool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
const tenant=randomUUID(),tenantOther=randomUUID();
const master=process.env.APP_ENCRYPTION_KEY!;
async function tokenFromFile(filename:string){const data=JSON.parse(await readFile(filename,'utf8'));return new URL(data.link).hash.split('=')[1]!;}
const headers=(user?:typeof r)=>({origin,...(user?{cookie:user.cookie,'x-csrf-token':user.me.csrf_token}:{})});
async function makeUser(email:string,name:string,tenantId:string,role:'member'|'tenant_admin'='member'){
  const invitation=await auth.invite(tenantId,email,role),token=await tokenFromFile(invitation.filename);
  const accepted=await app.inject({method:'POST',url:'/api/v1/auth/invitations/accept',headers:headers(),payload:{token,password,display_name:name}});
  expect(accepted.statusCode).toBe(201);
  const cookie=String(accepted.headers['set-cookie']).split(';')[0]!;
  const meResponse=await app.inject({url:'/api/v1/me',headers:{cookie}});expect(meResponse.statusCode).toBe(200);
  const me=meResponse.json();
  return {cookie,me,actor:await auth.authenticate(cookie.split('=')[1]),token};
}
beforeAll(async()=>{
  auth=await createAuth({databaseUrl:process.env.AUTH_DATABASE_URL!,profileDatabaseUrl:process.env.DATABASE_URL!,masterKey:master,origin,mailboxPath:process.env.MAILBOX_PATH!});
  app=await createApp({auth,origin,check:async()=>{await auth.check();await assertDatabaseReady(profilePool);},close:async()=>{}});
  await auth.pool.query('INSERT INTO jarvis_auth.tenants(id,name) VALUES($1,$2),($3,$4)',[tenant,'Synthetic team R/M',tenantOther,'Synthetic other team']);
  r=await makeUser(emailFor('r'),'CANARY_R_PRIVATE',tenant);
  m=await makeUser(emailFor('m'),'CANARY_M_PRIVATE',tenant);
  other=await makeUser(emailFor('other'),'CANARY_OTHER_PRIVATE',tenantOther);
  admin=await makeUser(emailFor('admin'),'CANARY_ADMIN_PRIVATE',tenant,'tenant_admin');
},20000);
afterAll(async()=>{if(app)await app.close();if(auth)await auth.close();await profilePool.end();});
describe('real identities and PostgreSQL isolation',()=>{
  it('stores only session/invitation hashes and sets HttpOnly/SameSite cookies',async()=>{
    const session=(await auth.pool.query('SELECT token_hash FROM jarvis_auth.sessions WHERE id=$1',[r.actor.sessionId])).rows[0];
    expect(session.token_hash).toBe(digest(r.cookie.split('=')[1]!));expect(session.token_hash).not.toBe(r.cookie.split('=')[1]);
    const response=await app.inject({method:'POST',url:'/api/v1/auth/login',headers:headers(),payload:{email:r.me.email,password}});
    expect(response.statusCode).toBe(200);expect(response.headers['set-cookie']).toContain('HttpOnly');expect(response.headers['set-cookie']).toContain('SameSite=Lax');
  });
  it('denies private IDs within tenant, across tenants and to an operational admin',async()=>{
    for(const user of [m,other,admin]){
      const result=await app.inject({url:'/api/v1/profiles/'+r.me.profile.id,headers:headers(user)});
      expect(result.statusCode).toBe(404);expect(result.body).not.toContain('CANARY_R');
    }
    await auth.pool.query('UPDATE jarvis_auth.users SET platform_admin=true WHERE id=$1',[admin.actor.userId]);
    expect((await app.inject({url:'/api/v1/profiles/'+r.me.profile.id,headers:headers(admin)})).statusCode).toBe(404);
    expect((await app.inject({url:'/api/v1/profiles/'+r.me.profile.id,headers:headers(r)})).json().display_name).toBe('CANARY_R_PRIVATE');
  });
  it('rejects forged ownership, missing CSRF and hostile Origin; versions updates',async()=>{
    const payload={display_name:'Updated R',timezone:'America/Cuiaba',expected_version:r.me.profile.version};
    expect((await app.inject({method:'PATCH',url:'/api/v1/me/profile',headers:headers(m),payload:{...payload,owner_user_id:r.actor.userId}})).statusCode).toBe(400);
    expect((await app.inject({method:'PATCH',url:'/api/v1/me/profile',headers:{cookie:r.cookie,origin},payload})).statusCode).toBe(403);
    expect((await app.inject({method:'PATCH',url:'/api/v1/me/profile',headers:{...headers(r),origin:'https://attacker.invalid'},payload})).statusCode).toBe(403);
    expect((await app.inject({method:'PATCH',url:'/api/v1/me/profile',headers:headers(r),payload:{...payload,timezone:'Invalid/Timezone'}})).statusCode).toBe(400);
    expect((await app.inject({method:'PATCH',url:'/api/v1/me/profile',headers:headers(r),payload})).statusCode).toBe(200);
    expect((await app.inject({method:'PATCH',url:'/api/v1/me/profile',headers:headers(r),payload})).statusCode).toBe(409);
  });
  it('enforces RLS under the real role including no-context and denied writes',async()=>{
    await assertDatabaseReady(profilePool);
    expect((await profilePool.query('SELECT * FROM jarvis.user_profiles')).rows).toEqual([]);
    expect((await scoped(profilePool,m.actor,c=>c.query('SELECT display_name FROM jarvis.user_profiles'))).rows).toEqual([{display_name:'CANARY_M_PRIVATE'}]);
    expect((await scoped(profilePool,m.actor,c=>c.query('UPDATE jarvis.user_profiles SET display_name=$1 WHERE id=$2',['stolen',r.me.profile.id]))).rowCount).toBe(0);
    await expect(scoped(profilePool,m.actor,c=>c.query('UPDATE jarvis.user_profiles SET owner_user_id=$1',[r.actor.userId]))).rejects.toMatchObject({code:'42501'});
    await expect(scoped(profilePool,m.actor,c=>c.query('DELETE FROM jarvis.user_profiles'))).rejects.toMatchObject({code:'42501'});
    await expect(profilePool.query('SELECT * FROM jarvis_auth.users')).rejects.toMatchObject({code:'42501'});
    await expect(auth.pool.query('SELECT * FROM jarvis.user_profiles')).rejects.toMatchObject({code:'42501'});
    await expect(scoped(auth.pool,m.actor,c=>c.query('INSERT INTO jarvis.user_profiles(id,tenant_id,owner_user_id,display_name) VALUES($1,$2,$3,$4)',[randomUUID(),tenant,r.actor.userId,'forged']))).rejects.toMatchObject({code:'42501'});
    const policies=await profilePool.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='jarvis.user_profiles'::regclass");
    expect(policies.rows[0]).toEqual({relrowsecurity:true,relforcerowsecurity:true});
  });
  it('does not leak transaction identity after SQL failure, timeout or concurrent use of pool=1',async()=>{
    await expect(scoped(profilePool,r.actor,c=>c.query('SELECT 1/0'))).rejects.toThrow();
    expect((await profilePool.query('SELECT * FROM jarvis.user_profiles')).rowCount).toBe(0);
    await expect(scoped(profilePool,r.actor,async c=>{await c.query("SET LOCAL statement_timeout='20ms'");await c.query('SELECT pg_sleep(0.1)');})).rejects.toMatchObject({code:'57014'});
    expect((await profilePool.query('SELECT * FROM jarvis.user_profiles')).rowCount).toBe(0);
    const values=await Promise.all([r,m,other].map(user=>scoped(profilePool,user.actor,c=>c.query('SELECT owner_user_id FROM jarvis.user_profiles'))));
    expect(values.map(v=>v.rows[0].owner_user_id)).toEqual([r.actor.userId,m.actor.userId,other.actor.userId]);
    expect((await profilePool.query('SELECT * FROM jarvis.user_profiles')).rowCount).toBe(0);
  });
  it('consumes an invitation once under concurrent acceptance and rejects expired tokens',async()=>{
    const invite=await auth.invite(tenant,emailFor('race'),'member'),token=await tokenFromFile(invite.filename);
    const results=await Promise.all([1,2].map(()=>app.inject({method:'POST',url:'/api/v1/auth/invitations/accept',headers:headers(),payload:{token,password,display_name:'Race fixture'}})));
    expect(results.map(x=>x.statusCode).sort()).toEqual([201,400]);
    const expired=await auth.invite(tenant,emailFor('expired'),'member');await auth.pool.query("UPDATE jarvis_auth.invitations SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);
    expect((await app.inject({method:'POST',url:'/api/v1/auth/invitations/accept',headers:headers(),payload:{token:await tokenFromFile(expired.filename),password,display_name:'Expired'}})).statusCode).toBe(400);
  });
  it('uses identical public login errors and rate-limits repeated attempts',async()=>{
    const a=await app.inject({method:'POST',url:'/api/v1/auth/login',headers:headers(),payload:{email:m.me.email,password:'wrong password'}});
    const b=await app.inject({method:'POST',url:'/api/v1/auth/login',headers:headers(),payload:{email:emailFor('absent'),password:'wrong password'}});
    expect(a.statusCode).toBe(401);expect(b.statusCode).toBe(401);expect(a.json().error.message).toBe(b.json().error.message);
    for(let i=0;i<10;i++)await auth.rateLimit('synthetic-rate:'+fixtureNamespace);await expect(auth.rateLimit('synthetic-rate:'+fixtureNamespace)).rejects.toMatchObject({statusCode:429});
  });
  it('revokes only owned sessions and immediately rejects revoked/expired memberships',async()=>{
    expect((await app.inject({method:'DELETE',url:'/api/v1/auth/sessions/'+r.actor.sessionId,headers:headers(m)})).statusCode).toBe(404);
    const fresh=await makeUser(emailFor('revoke'),'Revoke fixture',tenant);
    expect((await app.inject({method:'POST',url:'/api/v1/auth/logout',headers:headers(fresh),payload:{}})).statusCode).toBe(204);
    expect((await app.inject({url:'/api/v1/me',headers:headers(fresh)})).statusCode).toBe(401);
    await auth.pool.query('UPDATE jarvis_auth.memberships SET active=false WHERE user_id=$1',[other.actor.userId]);
    expect((await app.inject({url:'/api/v1/me',headers:headers(other)})).statusCode).toBe(401);
    await auth.pool.query('UPDATE jarvis_auth.memberships SET active=true WHERE user_id=$1',[other.actor.userId]);
    await auth.pool.query("UPDATE jarvis_auth.sessions SET expires_at=now()-interval '1 second' WHERE id=$1",[other.actor.sessionId]);
    expect((await app.inject({url:'/api/v1/me',headers:headers(other)})).statusCode).toBe(401);
  });
  it('recovers through a private local mailbox, consumes once and revokes all previous sessions',async()=>{
    const user=await makeUser(emailFor('recover'),'Recovery fixture',tenant);
    const responses=await Promise.all([emailFor('recover'),emailFor('nobody')].map(email=>app.inject({method:'POST',url:'/api/v1/auth/recovery/request',headers:headers(),payload:{email}})));
    expect(responses.map(x=>x.statusCode)).toEqual([202,202]);expect(responses[0]!.body).toBe(responses[1]!.body);
    const files=await readdir(process.env.MAILBOX_PATH!);let token='';
    for(const filename of files){const data=JSON.parse(await readFile(path.join(process.env.MAILBOX_PATH!,filename),'utf8'));if(data.kind==='recovery'&&data.to===emailFor('recover'))token=new URL(data.link).hash.split('=')[1]!;}
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const reset={token,password:'SYNTHETIC-new-password-2026'};
    expect((await app.inject({method:'POST',url:'/api/v1/auth/recovery/complete',headers:headers(),payload:reset})).statusCode).toBe(204);
    expect((await app.inject({url:'/api/v1/me',headers:headers(user)})).statusCode).toBe(401);
    expect((await app.inject({method:'POST',url:'/api/v1/auth/recovery/complete',headers:headers(),payload:reset})).statusCode).toBe(400);
    expect((await app.inject({method:'POST',url:'/api/v1/auth/login',headers:headers(),payload:{email:emailFor('recover'),password:reset.password}})).statusCode).toBe(200);
  });
  it('serializes two different recovery tokens without deadlocking or accepting both',async()=>{
    const user=await makeUser(emailFor('parallel-reset'),'Parallel reset fixture',tenant);
    const tokens=[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')];
    for(const token of tokens)await auth.pool.query("INSERT INTO jarvis_auth.recovery_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')",[randomUUID(),user.actor.userId,digest(token)]);
    const barrier=await auth.pool.connect();let requests:ReturnType<typeof app.inject>[]=[];
    try{
      await barrier.query('BEGIN');await barrier.query('SELECT id FROM jarvis_auth.users WHERE id=$1 FOR UPDATE',[user.actor.userId]);
      requests=tokens.map(token=>app.inject({method:'POST',url:'/api/v1/auth/recovery/complete',headers:headers(),payload:{token,password:'SYNTHETIC-parallel-reset-2026'}}));
      let waiting=0;
      for(let attempt=0;attempt<200;attempt++){
        waiting=Number((await auth.pool.query("SELECT count(*) FROM pg_stat_activity WHERE usename=current_user AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM jarvis_auth.users WHERE id=%'")).rows[0].count);
        if(waiting===2)break;await new Promise(resolve=>setTimeout(resolve,10));
      }
      expect(waiting).toBe(2);
    }finally{await barrier.query('ROLLBACK');barrier.release();}
    expect((await Promise.all(requests)).map(result=>result.statusCode).sort()).toEqual([204,400]);
  });
  it('requires encrypted MFA for administration, prevents TOTP replay and binds Secure cookie to HTTPS',async()=>{
    const invitationPayload={email:emailFor('admin-invite'),role:'member'};
    expect((await app.inject({method:'POST',url:'/api/v1/administration/invitations',headers:headers(admin),payload:invitationPayload})).statusCode).toBe(403);
    expect((await app.inject({method:'POST',url:'/api/v1/administration/invitations',headers:headers(m),payload:invitationPayload})).statusCode).toBe(403);
    const start=await app.inject({method:'POST',url:'/api/v1/auth/mfa/start',headers:headers(admin),payload:{password}});expect(start.statusCode).toBe(200);
    const factor=(await auth.pool.query('SELECT pending_ciphertext FROM jarvis_auth.mfa_factors WHERE user_id=$1',[admin.actor.userId])).rows[0];
    expect(factor.pending_ciphertext).not.toContain(start.json().secret);
    const seed=decryptSeed(factor.pending_ciphertext,master,admin.actor.userId),counter=Math.floor(Date.now()/30000);
    expect((await app.inject({method:'POST',url:'/api/v1/auth/mfa/confirm',headers:headers(admin),payload:{code:totp(seed,counter)}})).statusCode).toBe(204);
    expect((await app.inject({method:'POST',url:'/api/v1/administration/invitations',headers:headers(admin),payload:invitationPayload})).statusCode).toBe(202);
    expect((await app.inject({method:'POST',url:'/api/v1/auth/login',headers:headers(),payload:{email:admin.me.email,password,code:totp(seed,counter)}})).statusCode).toBe(401);
    const secureApp=await createApp({auth,origin:'https://jarvis.synthetic.invalid',mode:'foundation',check:async()=>{},close:async()=>{}});
    try{const login=await secureApp.inject({method:'POST',url:'/api/v1/auth/login',headers:{origin:'https://jarvis.synthetic.invalid'},payload:{email:m.me.email,password}});expect(login.statusCode).toBe(200);expect(login.headers['set-cookie']).toContain('__Host-jarvis_session=');expect(login.headers['set-cookie']).toContain('; Secure');}finally{await secureApp.close();}
  });
});
