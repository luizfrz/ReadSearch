// Proxy CORS próprio e mínimo (sem dependências) usado pela versão web
// para baixar páginas HTML que o navegador bloquearia.
//   npm run proxy                -> http://localhost:8787/fetch?url=<url>
//   EXPO_PUBLIC_PROXY_URL=http://localhost:8787  (no app)
const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const run = promisify(execFile);

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


// ---------- Conversão de formatos (opcional: exige ferramentas instaladas no servidor) ----------
//  POST /convert?from=mobi&to=epub  (corpo = arquivo)  -> { id }   ;   GET /out/<id> -> arquivo convertido
//  mobi/azw/azw3/lit/rtf/doc -> epub  (Calibre: ebook-convert)
//  djvu -> pdf                        (djvulibre: ddjvu)
//  cbr (RAR) -> cbz                   (7z ou unrar + zip)
const MAX_UPLOAD = 150 * 1024 * 1024;
const TOKEN = process.env.CONVERT_TOKEN; // se definido, exige o cabeçalho x-token
const ROUTES = { mobi: 'epub', azw: 'epub', azw3: 'epub', lit: 'epub', rtf: 'epub', doc: 'epub', djvu: 'pdf', cbr: 'cbz' };
const outputs = new Map();

const has = async (bin) => run('which', [bin]).then(() => true, () => false);

async function convertFile(from, dir, input, output) {
  if (from === 'djvu') {
    if (!(await has('ddjvu'))) throw new Error('Conversor não instalado no servidor: ddjvu (pacote djvulibre).');
    return run('ddjvu', ['-format=pdf', input, output], { timeout: 180000 });
  }
  if (from === 'cbr') {
    const ex = path.join(dir, 'x');
    fs.mkdirSync(ex);
    if (await has('7z')) await run('7z', ['x', '-y', `-o${ex}`, input], { timeout: 180000 });
    else if (await has('unrar')) await run('unrar', ['x', '-y', input, ex + path.sep], { timeout: 180000 });
    else throw new Error('Conversor não instalado no servidor: 7z ou unrar.');
    return run('zip', ['-r', '-q', output, '.'], { cwd: ex, timeout: 180000 });
  }
  if (!(await has('ebook-convert'))) throw new Error('Conversor não instalado no servidor: ebook-convert (instale o Calibre).');
  return run('ebook-convert', [input, output], { timeout: 180000 });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_UPLOAD) { req.destroy(); return reject(new Error('Arquivo grande demais')); }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleConvert(req, res, u, cors) {
  const json = (code, obj) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (TOKEN && req.headers['x-token'] !== TOKEN) return json(401, { error: 'Não autorizado' });
  const from = u.searchParams.get('from');
  const to = u.searchParams.get('to');
  if (!ROUTES[from] || ROUTES[from] !== to) return json(400, { error: 'Conversão não suportada' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-'));
  try {
    const input = path.join(dir, `in.${from}`);
    const output = path.join(dir, `out.${to}`);
    fs.writeFileSync(input, await readBody(req));
    await convertFile(from, dir, input, output);
    const id = crypto.randomBytes(12).toString('hex');
    outputs.set(id, { file: output, dir, to });
    setTimeout(() => { outputs.delete(id); fs.rmSync(dir, { recursive: true, force: true }); }, 10 * 60 * 1000);
    json(200, { id });
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    json(/não instalado/.test(e.message) ? 501 : 500, { error: e.message });
  }
}

function handleOut(res, id, cors) {
  const o = outputs.get(id);
  if (!o || !fs.existsSync(o.file)) { res.writeHead(404, cors); return res.end('não encontrado'); }
  const types = { epub: 'application/epub+zip', pdf: 'application/pdf', cbz: 'application/zip' };
  res.writeHead(200, { ...cors, 'content-type': types[o.to] });
  fs.createReadStream(o.file).pipe(res);
}

http
  .createServer(async (req, res) => {
    const cors = { 'access-control-allow-origin': ALLOW_ORIGIN, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type, x-token', vary: 'origin' };
    const u = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method === 'POST' && u.pathname === '/convert') return handleConvert(req, res, u, cors);
    if (req.method === 'GET' && u.pathname.startsWith('/out/')) return handleOut(res, u.pathname.slice(5), cors);
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
