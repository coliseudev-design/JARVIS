import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createAuth } from '../apps/api/dist/auth/store.js';
const email=z.email().parse(process.argv[2]);
const name=z.string().min(1).max(120).parse(process.argv[3]??'Workspace inicial');
if(!['development','foundation'].includes(process.env.APP_MODE))throw new Error('Pilot configuration required');
const auth=await createAuth({databaseUrl:process.env.AUTH_DATABASE_URL,profileDatabaseUrl:process.env.DATABASE_URL,masterKey:process.env.APP_ENCRYPTION_KEY,origin:process.env.PUBLIC_ORIGIN,mailboxPath:process.env.MAILBOX_PATH});
try{
 const total=await auth.pool.query('SELECT count(*)::integer AS total FROM jarvis_auth.users');
 if(total.rows[0].total!==0)throw new Error('Initial bootstrap is closed once a user exists; use authenticated MFA administration.');
 const tenantId=randomUUID();
 await auth.pool.query('INSERT INTO jarvis_auth.tenants(id,name) VALUES($1,$2)',[tenantId,name]);
 const result=await auth.invite(tenantId,email,'tenant_admin');
 console.log('Initial operator invitation stored in private local-test mailbox:',result.filename);
}finally{await auth.close();}
