import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { LoginSchema,AcceptInviteSchema,InviteSchema,RecoveryRequestSchema,RecoveryCompleteSchema,MeSchema,ProfileSchema,ProfileUpdateSchema,MfaStartSchema,MfaConfirmSchema,toJsonSchema } from '@jarvis/contracts';
import { AppError, invalid } from '../errors.js';
import { constantEqual } from './crypto.js';
import type { AuthService,Actor } from './store.js';

export function registerAuthRoutes(app:FastifyInstance,auth:AuthService,origin:string,development:boolean) {
  const secure = new URL(origin).protocol==='https:';
  const cookieName=secure?'__Host-jarvis_session':'jarvis_session';
  const allowedOrigins=new Set([origin,...(development?['http://127.0.0.1:5173']:[])]);
  const body = (schema:z.ZodType) => ({body:toJsonSchema(schema)});
  const originGuard = (req:FastifyRequest) => {
    if(!req.headers.origin || !allowedOrigins.has(req.headers.origin)) throw new AppError(403,'FORBIDDEN','Origem não permitida.');
  };
  const cookie = (req:FastifyRequest) => req.headers.cookie?.split(';').map(p=>p.trim()).find(p=>p.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  async function actor(req:FastifyRequest,mutation=false):Promise<Actor> {
    const a=await auth.authenticate(cookie(req));
    if(mutation) {
      originGuard(req);
      if(typeof req.headers['x-csrf-token']!=='string'||!constantEqual(req.headers['x-csrf-token'],auth.csrf(a))) throw new AppError(403,'FORBIDDEN','Validação de sessão necessária.');
    }
    return a;
  }
  const setCookie=(reply:FastifyReply,value:string,clear=false)=>reply.header('Set-Cookie',`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:43200}${secure?'; Secure':''}`);
  async function publicLimit(req:FastifyRequest,keyText:string) {
    // The private web proxy is the network peer, not the end user's IP.
    // Per-account/token limits plus an explicit pilot-wide circuit breaker.
    originGuard(req); await auth.rateLimit(keyText); await auth.rateLimit('pilot:public-auth',1000);
  }
  app.post('/api/v1/auth/login',{schema:body(LoginSchema)},async(req,reply)=>{
    const b=LoginSchema.parse(req.body); await publicLimit(req,'login:'+b.email.trim().toLowerCase());
    const token=await auth.login(b.email,b.password,b.code);setCookie(reply,token);return {authenticated:true};
  });
  app.post('/api/v1/auth/invitations/accept',{schema:body(AcceptInviteSchema)},async(req,reply)=>{
    const b=AcceptInviteSchema.parse(req.body);await publicLimit(req,'invite:'+b.token);
    const token=await auth.accept(b.token,b.password,b.display_name);setCookie(reply,token);return reply.code(201).send({authenticated:true});
  });
  app.get('/api/v1/me',{schema:{response:{200:toJsonSchema(MeSchema)}}},async req=>{
    const a=await actor(req);return {user_id:a.userId,tenant_id:a.tenantId,email:a.email,role:a.role,platform_admin:a.platformAdmin,mfa_enabled:a.mfaEnabled,mfa_verified:a.mfaVerified,csrf_token:auth.csrf(a),profile:await auth.profile(a)};
  });
  app.get('/api/v1/profiles/:id',{schema:{params:toJsonSchema(z.strictObject({id:z.uuid()})),response:{200:toJsonSchema(ProfileSchema)}}},async req=>{
    const a=await actor(req);return auth.profile(a,(req.params as {id:string}).id);
  });
  app.patch('/api/v1/me/profile',{schema:{...body(ProfileUpdateSchema),response:{200:toJsonSchema(ProfileSchema)}}},async req=>{
    const a=await actor(req,true),b=ProfileUpdateSchema.parse(req.body);
    try {new Intl.DateTimeFormat('pt-BR',{timeZone:b.timezone}).format();}catch{throw invalid();}
    return auth.updateProfile(a,b);
  });
  app.post('/api/v1/auth/logout',async(req,reply)=>{const a=await actor(req,true);await auth.revoke(a,a.sessionId);setCookie(reply,'',true);return reply.code(204).send();});
  app.get('/api/v1/auth/sessions',async req=>({items:await auth.sessions(await actor(req))}));
  app.delete('/api/v1/auth/sessions/:id',{schema:{params:toJsonSchema(z.strictObject({id:z.uuid()}))}},async(req,reply)=>{
    const a=await actor(req,true),id=(req.params as {id:string}).id;await auth.revoke(a,id);if(id===a.sessionId)setCookie(reply,'',true);return reply.code(204).send();
  });
  app.post('/api/v1/auth/recovery/request',{schema:body(RecoveryRequestSchema)},async(req,reply)=>{
    const b=RecoveryRequestSchema.parse(req.body);await publicLimit(req,'recovery:'+b.email.trim().toLowerCase());await auth.recoveryRequest(b.email);
    return reply.code(202).send({message:'Se a conta existir, as instruções estarão na caixa de testes local. Nenhum e-mail externo foi enviado.',delivery:'local_test_mailbox'});
  });
  app.post('/api/v1/auth/recovery/complete',{schema:body(RecoveryCompleteSchema)},async(req,reply)=>{
    const b=RecoveryCompleteSchema.parse(req.body);await publicLimit(req,'reset:'+b.token);await auth.recoveryComplete(b.token,b.password,b.code);setCookie(reply,'',true);return reply.code(204).send();
  });
  app.post('/api/v1/auth/mfa/start',{schema:body(MfaStartSchema)},async req=>{
    const a=await actor(req,true);await auth.rateLimit('mfa:'+a.userId);return auth.startMfa(a,MfaStartSchema.parse(req.body).password);
  });
  app.post('/api/v1/auth/mfa/confirm',{schema:body(MfaConfirmSchema)},async(req,reply)=>{
    const a=await actor(req,true);await auth.rateLimit('mfa-confirm:'+a.userId);await auth.confirmMfa(a,MfaConfirmSchema.parse(req.body).code);return reply.code(204).send();
  });
  app.post('/api/v1/administration/invitations',{schema:body(InviteSchema)},async(req,reply)=>{
    const a=await actor(req,true);auth.requireAdmin(a);await auth.rateLimit('admin-invite:'+a.userId,30);
    const b=InviteSchema.parse(req.body),result=await auth.invite(a.tenantId,b.email,b.role);
    return reply.code(202).send({invitation_id:result.id,delivery:'local_test_mailbox'});
  });
}
