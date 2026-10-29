// Proxy CORS próprio e mínimo (sem dependências) usado pela versão web
// para baixar páginas HTML que o navegador bloquearia.
//   npm run proxy                -> http://localhost:8787/fetch?url=<url>
//   EXPO_PUBLIC_PROXY_URL=http://localhost:8787  (no app)
const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const net = require('net');

const PORT = process.env.PORT || 8787;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

function isPrivate(ip) {
  if (net.isIPv6(ip)) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith('::ffff:127.');
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// Bloqueia destinos internos (SSRF), inclusive após redirecionamentos.
async function assertPublic(u) {
  if (!/^https?:$/.test(u.protocol)) throw new Error('Protocolo não permitido');
  const { address } = await dns.lookup(u.hostname);
  if (isPrivate(address)) throw new Error('Destino não permitido');
  return address;
}

async function get(url, hops = 0) {
  const u = new URL(url);
  const address = await assertPublic(u);
  return new Promise((resolve, reject) => {
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.get(
      u,
      { headers: { 'user-agent': 'ReadSearchProxy/1.0', accept: 'text/html,*/*' }, timeout: 10000, lookup: (_h, o, cb) => { const f = net.isIPv6(address) ? 6 : 4; return o && o.all ? cb(null, [{ address, family: f }]) : cb(null, address, f); } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (hops >= MAX_REDIRECTS) return reject(new Error('Redirecionamentos demais'));
          return resolve(get(new URL(res.headers.location, u).href, hops + 1));
        }
        let size = 0;
        const chunks = [];
        res.on('data', (c) => {
          size += c.length;
          if (size > MAX_BYTES) { req.destroy(); return reject(new Error('Resposta grande demais')); }
          chunks.push(c);
        });
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || 'text/html', body: Buffer.concat(chunks) }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado')));
    req.on('error', reject);
  });
}

http
  .createServer(async (req, res) => {
    const cors = { 'access-control-allow-origin': ALLOW_ORIGIN, 'access-control-allow-methods': 'GET', vary: 'origin' };
    const u = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (u.pathname !== '/fetch' || !u.searchParams.get('url')) { res.writeHead(404, cors); return res.end('use /fetch?url='); }
    try {
      const r = await get(u.searchParams.get('url'));
      res.writeHead(r.status, { ...cors, 'content-type': r.type });
      res.end(r.body);
    } catch (e) {
      res.writeHead(502, cors);
      res.end(e.message);
    }
  })
  .listen(PORT, () => console.log(`Proxy em http://localhost:${PORT}/fetch?url=...`));
