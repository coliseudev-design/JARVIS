import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../apps/web/dist/', import.meta.url));
const origin = new URL(process.env.API_ORIGIN ?? 'http://127.0.0.1:3001');
if (origin.protocol !== 'http:') throw new Error('Internal API must use the configured private HTTP service');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
  if (!['GET','HEAD','POST','PATCH','DELETE'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  if (pathname.startsWith('/api/') || pathname.startsWith('/health/')) {
    // Fixed private origin. Authentication/CSRF are enforced by the API.
    const headers={};
    for(const name of ['cookie','content-type','content-length','origin','x-csrf-token'])if(req.headers[name])headers[name]=req.headers[name];
    const upstream = http.request(new URL(pathname, origin), { method: req.method, headers, timeout: 10000 }, reply => {
      if(reply.headers['set-cookie'])res.setHeader('Set-Cookie',reply.headers['set-cookie']);
      res.writeHead(reply.statusCode ?? 502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); reply.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }); res.end('{"error":"API unavailable"}'); });
    req.on('aborted',()=>upstream.destroy());
    return req.pipe(upstream);
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  const target = path.resolve(root, '.' + pathname);
  if (target !== path.resolve(root) && !target.startsWith(path.resolve(root) + path.sep)) { res.writeHead(400); return res.end(); }
  try {
    const filename = pathname === '/' ? path.join(root, 'index.html') : target;
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.WEB_PORT ?? 8080), process.env.WEB_HOST ?? '127.0.0.1', () => console.log('JARVIS foundation web started'));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
