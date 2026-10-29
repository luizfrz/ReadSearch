import JSZip from 'jszip';
import { readBase64 } from './files';

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
};

const dirname = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');

function resolvePath(base, href) {
  const clean = decodeURIComponent(href.split('#')[0].split('?')[0]);
  const parts = (clean.startsWith('/') ? clean.slice(1) : base + clean).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };

export async function loadEpub(uri) {
  const zip = await JSZip.loadAsync(await readBase64(uri), { base64: true });
  const container = await zip.file('META-INF/container.xml').async('string');
  const opfPath = attr(container.match(/<rootfile\b[^>]*>/i)[0], 'full-path');
  const opf = await zip.file(opfPath).async('string');
  const base = dirname(opfPath);

  const manifest = {};
  (opf.match(/<item\b[^>]*>/gi) || []).forEach((t) => {
    manifest[attr(t, 'id')] = { href: attr(t, 'href'), type: attr(t, 'media-type') };
  });
  const chapters = (opf.match(/<itemref\b[^>]*>/gi) || [])
    .map((t) => manifest[attr(t, 'idref')])
    .filter((m) => m && /html/.test(m.type || ''))
    .map((m) => resolvePath(base, m.href));
  if (!chapters.length) throw new Error('EPUB sem capítulos legíveis.');

  const title = ((opf.match(/<dc:title[^>]*>([^<]*)</i) || [])[1] || '').trim();
  return { zip, chapters, title };
}

const READER_CSS = `<style>
body{font-family:Georgia,serif;line-height:1.65;margin:0;padding:20px;background:#fafaf7;color:#1c1c1c;font-size:18px}
img,svg{max-width:100%;height:auto}h1,h2,h3{line-height:1.25}
@media (prefers-color-scheme:dark){body{background:#0b0d12;color:#e6e7ea}a{color:#ff7a7e}}
</style>`;

// Monta o HTML de um capítulo com imagens e CSS embutidos (data URIs).
export async function renderChapter(epub, index) {
  const path = epub.chapters[index];
  const dir = dirname(path);
  let html = await epub.zip.file(path).async('string');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');

  const inline = async (re, build) => {
    const matches = [...html.matchAll(re)];
    for (const m of matches) {
      const file = epub.zip.file(resolvePath(dir, m[2]));
      if (!file) continue;
      html = html.replace(m[0], await build(m, file));
    }
  };

  await inline(/(<img\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi, async (m, f) => {
    const ext = m[2].split('.').pop().toLowerCase();
    return `${m[1]}data:${MIME[ext] || 'image/jpeg'};base64,${await f.async('base64')}${m[3]}`;
  });
  await inline(/(<link\b[^>]*?\bhref\s*=\s*["'])([^"']+\.css)(["'][^>]*>)/gi, async (_m, f) => `<style>${await f.async('string')}</style>`);

  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [null, html])[1];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${READER_CSS}</head><body>${body}</body></html>`;
}
