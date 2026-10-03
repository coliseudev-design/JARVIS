import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile,mkdir } from 'node:fs/promises';
import net from 'node:net';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createAuth } from '../apps/api/dist/auth/store.js';
if(process.env.F02_ISOLATED_DATABASE!=='1')throw new Error('Browser fixtures require a disposable identity database');
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const apiPort=await port(),webPort=await port(),origin=`http://127.0.0.1:${webPort}`;
const env={...process.env,APP_MODE:'development',HOST:'127.0.0.1',PORT:String(apiPort),WEB_PORT:String(webPort),WEB_HOST:'127.0.0.1',API_ORIGIN:`http://127.0.0.1:${apiPort}`,PUBLIC_ORIGIN:origin};
const api=spawn(process.execPath,['apps/api/dist/server.js'],{env,stdio:['ignore','pipe','pipe']}),web=spawn(process.execPath,['scripts/serve-web.mjs'],{env,stdio:['ignore','pipe','pipe']});
const auth=await createAuth({databaseUrl:env.AUTH_DATABASE_URL,profileDatabaseUrl:env.DATABASE_URL,masterKey:env.APP_ENCRYPTION_KEY,origin,mailboxPath:env.MAILBOX_PATH});
let browser;
try{
  let ready=false;
  for(let attempt=0;attempt<80;attempt++){try{ready=(await fetch(origin+'/health/ready')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  assert(ready,'Browser test services not ready');
  const tenant=randomUUID();await auth.pool.query('INSERT INTO jarvis_auth.tenants(id,name) VALUES($1,$2)',[tenant,'Browser synthetic fixtures']);
  const invites=[];
  for(const who of ['r','m']){const email=`browser-${who}-${randomUUID()}@synthetic.invalid`;const invitation=await auth.invite(tenant,email,'member');invites.push({email,...JSON.parse(await readFile(invitation.filename,'utf8'))});}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const r=await browser.newContext({viewport:{width:1440,height:900}}),m=await browser.newContext({viewport:{width:390,height:844}});
  const rp=await r.newPage(),mp=await m.newPage();const errors=[];rp.on('pageerror',e=>errors.push(e.message));mp.on('pageerror',e=>errors.push(e.message));
  for(const [p,invite,name] of [[rp,invites[0],'Browser R canary'],[mp,invites[1],'Browser M canary']]){
    await p.goto(invite.link);await p.getByLabel('Como podemos chamar você?').fill(name);await p.getByLabel('Senha',{exact:true}).fill('SYNTHETIC-browser-password-2026');await p.getByRole('button',{name:'Criar minha conta',exact:true}).click();
    await p.getByRole('heading',{name:`Olá, ${name}`,exact:true}).waitFor();
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Viewport overflow');
  }
  const rme=await (await rp.request.get(origin+'/api/v1/me')).json();
  assert.equal((await mp.request.get(origin+'/api/v1/profiles/'+rme.profile.id)).status(),404,'Cross-user profile access');
  assert(!(await mp.locator('body').innerText()).includes('Browser R canary'),'Private UI content leaked');
  await rp.getByLabel('Nome',{exact:true}).fill('Browser R atualizado');await rp.getByRole('button',{name:'Salvar perfil'}).click();await rp.getByRole('heading',{name:'Olá, Browser R atualizado',exact:true}).waitFor();
  const cookies=await r.cookies();assert(cookies.some(c=>c.name==='jarvis_session'&&c.httpOnly&&c.sameSite==='Lax'),'Cookie flags');
  await mkdir('.local/evidence',{recursive:true});await rp.screenshot({path:'.local/evidence/f02-desktop.png',fullPage:true});await mp.screenshot({path:'.local/evidence/f02-mobile.png',fullPage:true});
  await rp.getByRole('button',{name:'Sair',exact:true}).click();await rp.getByRole('heading',{name:'Entre no seu espaço',exact:true}).waitFor();
  assert.equal((await rp.request.get(origin+'/api/v1/me')).status(),401,'Logout did not revoke');
  await rp.getByLabel('E-mail',{exact:true}).fill(invites[0].email);await rp.getByLabel('Senha',{exact:true}).fill('SYNTHETIC-browser-password-2026');await rp.getByRole('button',{name:'Entrar',exact:true}).last().click();await rp.getByRole('heading',{name:'Olá, Browser R atualizado',exact:true}).waitFor();
  assert.deepEqual(errors,[],'Browser JavaScript errors');
  console.log('Chromium: two accounts, invitation, login, profile update, cookie flags, IDOR denial, logout and desktop/mobile layouts passed.');
}finally{
  if(browser)await browser.close();await auth.close();
  for(const proc of [api,web]){if(proc.exitCode===null){proc.kill('SIGTERM');await Promise.race([new Promise(r=>proc.once('exit',r)),new Promise(r=>setTimeout(()=>{proc.kill('SIGKILL');r();},3000))]);}}
}
