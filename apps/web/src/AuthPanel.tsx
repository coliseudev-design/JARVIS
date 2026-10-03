import { useEffect,useState,type FormEvent } from 'react';
import { MeSchema,type Me } from '@jarvis/contracts';

type Mode='login'|'invite'|'recovery'|'reset';
async function request(path:string,method='GET',body?:unknown,csrf?:string) {
  const response=await fetch('/api/v1'+path,{method,credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});
  const data=response.status===204?null:await response.json();
  if(!response.ok)throw new Error(data?.error?.message??'Não foi possível concluir a operação.');
  return data;
}
export function AuthPanel(){
  const initial=new URLSearchParams(window.location.hash.slice(1));
  const [mode,setMode]=useState<Mode>(initial.has('invite')?'invite':initial.has('recovery')?'reset':'login');
  const [token,setToken]=useState(initial.get('invite')??initial.get('recovery')??'');
  const [me,setMe]=useState<Me|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState(''),[name,setName]=useState('');
  const [zone,setZone]=useState('America/Cuiaba'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [sessions,setSessions]=useState<Array<{id:string;created_at:string;current:boolean}>>([]);
  const [enrollment,setEnrollment]=useState<{secret:string}|null>(null),[inviteEmail,setInviteEmail]=useState('');
  async function load(){const value=MeSchema.parse(await request('/me'));setMe(value);setName(value.profile.display_name);setZone(value.profile.timezone);setSessions((await request('/auth/sessions')).items);}
  useEffect(()=>{
    if(window.location.hash)window.history.replaceState(null,'',window.location.pathname+window.location.search);
    let active=true;
    request('/me').then(value=>{if(active){const m=MeSchema.parse(value);setMe(m);setName(m.profile.display_name);setZone(m.profile.timezone);return request('/auth/sessions').then(s=>{if(active)setSessions(s.items);});}}).catch(()=>{}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  async function action(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn();}catch(error){setMessage(error instanceof Error?error.message:'Falha ao conectar.');}finally{setBusy(false);}}
  function submit(event:FormEvent){event.preventDefault();void action(async()=>{
    if(mode==='login')await request('/auth/login','POST',{email,password,...(code?{code}:{})});
    if(mode==='invite')await request('/auth/invitations/accept','POST',{token,password,display_name:name});
    if(mode==='recovery'){const result=await request('/auth/recovery/request','POST',{email});setMessage(result.message);return;}
    if(mode==='reset'){await request('/auth/recovery/complete','POST',{token,password,...(code?{code}:{})});setMode('login');setToken('');setPassword('');setCode('');setMessage('Senha alterada. Entre novamente; as sessões anteriores foram revogadas.');return;}
    setPassword('');setCode('');setToken('');await load();
  });}
  if(loading)return <section className="panel auth-panel" aria-live="polite">Verificando sua sessão…</section>;
  return <section className="panel auth-panel" aria-labelledby="access-title">
    <div className="panel-heading"><div><p className="eyebrow">ACESSO PESSOAL · PILOTO</p><h2 id="access-title">{me?`Olá, ${me.profile.display_name}`:mode==='invite'?'Aceitar convite':mode==='recovery'?'Recuperar acesso':mode==='reset'?'Definir nova senha':'Entre no seu espaço'}</h2></div>{me&&<button disabled={busy} onClick={()=>void action(async()=>{await request('/auth/logout','POST',{},me.csrf_token);setMe(null);setSessions([]);setEnrollment(null);setMode('login');setName('');setEmail('');setToken('');setPassword('');setCode('');setZone('America/Cuiaba');})}>Sair</button>}</div>
    <p className="auth-notice">Contas e perfis estão disponíveis neste piloto. Conversas, memória e integrações serão liberadas nas próximas etapas.</p>
    <p className="notice" role="status" aria-live="polite">{message}</p>
    {!me?<>
      <nav className="auth-tabs" aria-label="Acesso">{([['login','Entrar'],['invite','Tenho um convite'],['recovery','Esqueci a senha'],['reset','Tenho código de recuperação']] as const).map(([value,label])=><button key={value} aria-pressed={mode===value} disabled={busy} onClick={()=>{setMode(value);setMessage('');setPassword('');setCode('');}}>{label}</button>)}</nav>
      <form onSubmit={submit}>
        {(mode==='login'||mode==='recovery')&&<label>E-mail<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
        {(mode==='invite'||mode==='reset')&&<label>Código {mode==='invite'?'do convite':'de recuperação'}<input type="password" autoComplete="off" required pattern="[a-f0-9]{64}" value={token} onChange={e=>setToken(e.target.value)}/></label>}
        {mode==='invite'&&<label>Como podemos chamar você?<input autoComplete="nickname" required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>}
        {mode!=='recovery'&&<div><label>{mode==='reset'?'Nova senha':'Senha'}<input type="password" aria-describedby="password-hint" required minLength={12} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label><small id="password-hint">Use pelo menos 12 caracteres.</small></div>}
        {(mode==='login'||mode==='reset')&&<label>Código do autenticador, se ativado<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></label>}
        <button className="primary" disabled={busy}>{busy?'Aguarde…':mode==='recovery'?'Solicitar recuperação':mode==='reset'?'Alterar senha':mode==='invite'?'Criar minha conta':'Entrar'}</button>
      </form>
      <p className="auth-notice">Convites e recuperação usam uma caixa de testes privada no servidor. O operador entrega o link com segurança; não há envio de e-mail externo nesta etapa.</p>
    </>:<>
      <form onSubmit={event=>{event.preventDefault();void action(async()=>{await request('/me/profile','PATCH',{display_name:name,timezone:zone,expected_version:me.profile.version},me.csrf_token);await load();setMessage('Perfil atualizado.');});}}>
        <h3>Seu perfil privado</h3><label>Nome<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label><label>Fuso horário<input required list="timezones" value={zone} onChange={e=>setZone(e.target.value)}/><datalist id="timezones"><option value="America/Cuiaba"/><option value="America/Sao_Paulo"/><option value="Europe/Lisbon"/><option value="UTC"/></datalist></label><button disabled={busy}>Salvar perfil</button>
      </form>
      <div className="account-section"><h3>Sessões ativas</h3><ul>{sessions.map(s=><li key={s.id}><span>{s.current?'Esta sessão':'Outra sessão'} · {new Date(s.created_at).toLocaleString('pt-BR',{timeZone:me.profile.timezone})}</span>{!s.current&&<button disabled={busy} onClick={()=>void action(async()=>{await request('/auth/sessions/'+s.id,'DELETE',undefined,me.csrf_token);await load();setMessage('Sessão revogada.');})}>Revogar</button>}</li>)}</ul></div>
      <div className="account-section"><h3>Segundo fator</h3>{me.mfa_enabled?<p>Ativo. O código do seu autenticador será exigido no próximo login e na recuperação de senha.</p>:<form onSubmit={event=>{event.preventDefault();void action(async()=>{if(enrollment){await request('/auth/mfa/confirm','POST',{code},me.csrf_token);setEnrollment(null);setCode('');await load();setMessage('Segundo fator ativado. Outras sessões foram revogadas.');}else{setEnrollment(await request('/auth/mfa/start','POST',{password},me.csrf_token));setPassword('');}});}}>
        <p>Obrigatório para administrar convites. Guarde o acesso ao autenticador; recuperação de fator perdido ainda depende de um procedimento operacional.</p>
        {enrollment?<><p>Adicione esta chave ao autenticador (TOTP, 6 dígitos, 30 segundos). Ela só aparece durante esta configuração.</p><code className="mfa-secret">{enrollment.secret}</code><label>Código do autenticador<input required inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}/></label></>:<label>Confirme sua senha<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>}
        <button disabled={busy}>{enrollment?'Confirmar segundo fator':'Configurar segundo fator'}</button>
      </form>}</div>
      {(me.role==='tenant_admin'||me.platform_admin)&&<form className="account-section" onSubmit={event=>{event.preventDefault();void action(async()=>{await request('/administration/invitations','POST',{email:inviteEmail,role:'member'},me.csrf_token);setInviteEmail('');setMessage('Convite criado na caixa de testes local. Nenhum e-mail externo foi enviado.');});}}><h3>Convidar uma pessoa</h3><p>O convite cria uma conta separada. Ele não compartilha seu perfil ou conteúdo pessoal.</p><label>E-mail<input type="email" required value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label><button disabled={busy||!me.mfa_enabled||!me.mfa_verified}>Criar convite</button>{!me.mfa_verified&&<small>Ative o segundo fator ou entre novamente com seu código.</small>}</form>}
    </>}
  </section>;
}
