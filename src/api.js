import { cacheGet, cacheSet } from './cache';
import { Platform } from 'react-native';
import { detectIntent, rank } from './intent';
import { isOpenable, readableFormats } from './formats';

// Busca em fontes abertas e gratuitas (sem chave de API):
//  - HQ / Livros: Internet Archive
//  - Livros: Project Gutenberg (Gutendex)
//  - Artigos: OpenAlex
export const KINDS = [
  { key: 'all', label: 'Tudo' },
  { key: 'hq', label: 'HQ' },
  { key: 'manga', label: 'Mangá' },
  { key: 'book', label: 'Livros' },
  { key: 'article', label: 'Artigos' },
];

const IA = 'https://archive.org';

const PROXY = process.env.EXPO_PUBLIC_PROXY_URL;

// Na web, se o navegador bloquear por CORS e houver proxy próprio, repete a chamada por ele.
const TIMEOUT_MS = 8000;

// fetch com limite de tempo: uma fonte lenta não pode segurar a busca inteira.
function timedFetch(url, signal) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => c.abort());
  return fetch(url, { signal: c.signal }).finally(() => clearTimeout(timer));
}

async function netFetch(url, signal) {
  try {
    return await timedFetch(url, signal);
  } catch (e) {
    if (Platform.OS === 'web' && PROXY && e.name !== 'AbortError') {
      return timedFetch(`${PROXY.replace(/\/$/, '')}/fetch?url=${encodeURIComponent(url)}`, signal);
    }
    throw e;
  }
}

async function getText(url, signal) {
  const res = await netFetch(url, signal);
  if (!res.ok) throw new Error(`Falha na busca (${res.status})`);
  return res.text();
}

async function getJson(url, signal) {
  const res = await netFetch(url, signal);
  if (!res.ok) throw new Error(`Falha na busca (${res.status})`);
  return res.json();
}

// Remove caracteres especiais do Lucene que quebrariam a consulta.
const clean = (q) => q.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim();

async function searchArchive(query, kind, signal) {
  // Busca só em título/autor: ~4x mais rápida que a busca em texto completo.
  const t = clean(query).split(' ').join(' AND ');
  const scope =
    kind === 'hq'
      ? '(subject:comics OR collection:comics)'
      : 'NOT subject:comics';
  const q = `(title:(${t}) OR creator:(${t})) AND ${scope} AND mediatype:texts AND NOT access-restricted-item:true`;
  const url =
    `${IA}/advancedsearch.php?q=${encodeURIComponent(q)}` +
    '&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=format&rows=40&output=json&sort[]=downloads+desc';
  const data = await getJson(url, signal);
  // Só entram itens com ao menos um formato que o app abre (descarta empréstimos criptografados etc.).
  return data.response.docs
    .map((d) => ({ d, formats: readableFormats(d.format) }))
    .filter(({ formats }) => formats.length)
    .map(({ d, formats }) => ({
      id: `ia:${d.identifier}`,
      title: d.title,
      author: Array.isArray(d.creator) ? d.creator.join(', ') : d.creator,
      cover: `${IA}/services/img/${d.identifier}`,
      kind,
      source: 'Internet Archive',
      formats,
      resolve: { type: 'ia', identifier: d.identifier },
    }));
}

async function searchGutenberg(query, signal) {
  const data = await getJson(`https://gutendex.com/books/?search=${encodeURIComponent(query)}`, signal);
  return data.results.map((b) => {
    const f = b.formats;
    const html = f['text/html'] || f['text/html; charset=utf-8'];
    const epub = f['application/epub+zip'];
    return {
      id: `pg:${b.id}`,
      title: b.title,
      author: b.authors.map((a) => a.name).join(', '),
      cover: f['image/jpeg'],
      kind: 'book',
      source: 'Project Gutenberg',
      resolve: epub ? { type: 'epub', url: epub } : html ? { type: 'web', url: html } : null,
    };
  }).filter((b) => b.resolve);
}

const MANGADEX = 'https://api.mangadex.org';
const RATING = 'contentRating[]=safe&contentRating[]=suggestive';
const LANGS = 'translatedLanguage[]=pt-br&translatedLanguage[]=en';

async function searchManga(query, signal) {
  const url = `${MANGADEX}/manga?title=${encodeURIComponent(query)}&limit=20&includes[]=cover_art&${RATING}&order[relevance]=desc`;
  const data = await getJson(url, signal);
  return data.data.map((m) => {
    const titles = m.attributes.title;
    const cover = m.relationships.find((r) => r.type === 'cover_art');
    const file = cover && cover.attributes && cover.attributes.fileName;
    const author = m.relationships.find((r) => r.type === 'author');
    return {
      id: `md:${m.id}`,
      title: titles.en || titles['pt-br'] || Object.values(titles)[0],
      author: author && author.attributes ? author.attributes.name : undefined,
      cover: file ? `https://uploads.mangadex.org/covers/${m.id}/${file}.256.jpg` : undefined,
      kind: 'manga',
      source: 'MangaDex',
      resolve: { type: 'manga', mangaId: m.id },
    };
  });
}

// Repositórios do GitHub que reúnem livros; ao abrir, o app lista os PDF/EPUB do repositório.
const GH_TOKEN = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

// GitHub sem token permite só 60 chamadas/hora: com EXPO_PUBLIC_GITHUB_TOKEN o limite sobe para 5000.
async function ghJson(url, signal) {
  const headers = { Accept: 'application/vnd.github+json', ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}) };
  const res = await fetch(url, { signal, headers });
  if (!res.ok) throw new Error(`GitHub (${res.status})`);
  return res.json();
}

// Quantos PDFs (de até 100 MB) o repositório tem; o resultado fica em cache para não gastar a cota.
async function countRepoPdfs(fullName, signal) {
  const key = `v2:ghpdf:${fullName}`;
  const cached = await cacheGet(key);
  if (cached != null) return cached;
  const d = await ghJson(`https://api.github.com/repos/${fullName}/git/trees/HEAD?recursive=1`, signal);
  const n = (d.tree || []).filter((f) => f.type === 'blob' && /\.pdf$/i.test(f.path) && f.size < 100 * 1024 * 1024).length;
  cacheSet(key, n);
  return n;
}

// Só aparecem repositórios que realmente contêm ao menos um .pdf. Se não der para verificar
// (limite da API, erro de rede), o repositório fica de fora em vez de aparecer sem garantia.
async function searchGithub(query, signal) {
  const q = `${clean(query)} (pdf OR ebook OR livro OR book) in:name,description,topics`;
  const data = await ghJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=10`, signal);
  const checked = await Promise.all((data.items || []).map(async (r) => {
    try {
      return { r, pdfs: await countRepoPdfs(r.full_name, signal) };
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return { r, pdfs: 0 };
    }
  }));
  return checked
    .filter(({ pdfs }) => pdfs > 0)
    .map(({ r, pdfs }) => ({
      id: `gh:${r.full_name}`,
      title: r.name.replace(/[-_]+/g, ' '),
      author: r.owner.login,
      cover: r.owner.avatar_url,
      kind: 'book',
      source: `GitHub · ${pdfs} ${pdfs === 1 ? 'PDF' : 'PDFs'}`,
      formats: ['pdf'],
      resolve: { type: 'github', repo: r.full_name },
    }));
}

// Capítulos legíveis no MangaDex (pt-br e inglês), sem os que só existem em sites externos.
export async function getMangaChapters(mangaId) {
  const out = [];
  for (let offset = 0; offset < 1500; offset += 500) {
    const d = await getJson(`${MANGADEX}/manga/${mangaId}/feed?${LANGS}&${RATING}&includeExternalUrl=0&order[chapter]=asc&limit=500&offset=${offset}`);
    out.push(...d.data);
    if (offset + 500 >= d.total) break;
  }
  const byNumber = new Map();
  for (const c of out) {
    const a = c.attributes;
    if (!a.pages) continue;
    const key = a.chapter || c.id;
    const prev = byNumber.get(key);
    if (!prev || (a.translatedLanguage === 'pt-br' && prev.lang !== 'pt-br')) {
      byNumber.set(key, { id: c.id, number: a.chapter, title: a.title, lang: a.translatedLanguage, pages: a.pages });
    }
  }
  return [...byNumber.values()];
}

// URLs das imagens de um capítulo (versão otimizada "data-saver" para carregar mais rápido).
export async function getChapterPages(chapterId) {
  const d = await getJson(`${MANGADEX}/at-home/server/${chapterId}`);
  return d.chapter.dataSaver.map((f) => `${d.baseUrl}/data-saver/${d.chapter.hash}/${f}`);
}

// Somente arquivos .pdf de um repositório do GitHub.
export async function listRepoFiles(fullName) {
  const d = await ghJson(`https://api.github.com/repos/${fullName}/git/trees/HEAD?recursive=1`);
  return (d.tree || [])
    .filter((f) => f.type === 'blob' && /\.pdf$/i.test(f.path) && f.size < 100 * 1024 * 1024)
    .map((f) => {
      const type = f.path.split('.').pop().toLowerCase();
      return {
        path: f.path,
        name: f.path.split('/').pop().replace(/\.\w+$/, ''),
        size: f.size,
        type,
        url: `https://raw.githubusercontent.com/${fullName}/HEAD/${f.path.split('/').map(encodeURIComponent).join('/')}`,
      };
    });
}

// Wikisource (obras em domínio público, inclusive em português). A página vira EPUB ao abrir.
async function searchWikisource(query, signal) {
  const url = `https://pt.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=10&format=json&origin=*`;
  const data = await getJson(url, signal);
  return data.query.search.map((r) => ({
    id: `ws:${r.pageid}`,
    title: r.title,
    kind: 'book',
    source: 'Wikisource',
    resolve: { type: 'wikisource', title: r.title },
  }));
}

export async function getWikisourceHtml(title) {
  const d = await getJson(`https://pt.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&origin=*&redirects=1`);
  return d.parse.text['*'];
}

// arXiv: artigos científicos com PDF direto.
async function searchArxiv(query, signal) {
  const xml = await getText(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(clean(query))}&max_results=10`, signal);
  return (xml.match(/<entry>[\s\S]*?<\/entry>/g) || []).map((e) => {
    const pick = (re) => ((e.match(re) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const id = pick(/<id>([^<]+)<\/id>/).split('/abs/')[1];
    return {
      id: `ax:${id}`,
      title: pick(/<title>([\s\S]*?)<\/title>/),
      author: [...e.matchAll(/<name>([^<]+)<\/name>/g)].slice(0, 3).map((m) => m[1]).join(', '),
      kind: 'article',
      source: `arXiv · ${pick(/<published>(\d{4})/)}`,
      resolve: { type: 'pdf', url: `https://arxiv.org/pdf/${id}` },
    };
  });
}

async function searchArticles(query, signal) {
  const url =
    `https://api.openalex.org/works?search=${encodeURIComponent(query)}` +
    '&filter=open_access.is_oa:true&per-page=15&select=id,display_name,authorships,publication_year,primary_location,best_oa_location,open_access';
  const data = await getJson(url, signal);
  return data.results
    .map((w) => {
      const loc = w.primary_location || {};
      const pdf = loc.pdf_url || (w.best_oa_location && w.best_oa_location.pdf_url);
      const page = (w.open_access && w.open_access.oa_url) || loc.landing_page_url;
      const resolve = pdf ? { type: 'pdf', url: pdf } : page ? { type: 'web', url: page } : null;
      return {
        id: `oa:${w.id}`,
        title: w.display_name,
        author: (w.authorships || []).slice(0, 3).map((a) => a.author.display_name).join(', '),
        kind: 'article',
        source: `OpenAlex${w.publication_year ? ' · ' + w.publication_year : ''}`,
        resolve,
      };
    })
    .filter((a) => a.title && a.resolve);
}

// Consulta as fontes do tipo `kind` ('all' = todas) e entrega os resultados ordenados por
// relevância assim que cada fonte responde, sem esperar pela mais lenta.
async function runSearch(q, kind, { signal, onResults, onProgress }) {
  const key = `v2:${kind}:${q.toLowerCase()}`;
  const cached = await cacheGet(key);
  if (cached) {
    onResults && onResults(cached);
    return cached;
  }
  let acc = [];
  const push = (list) => {
    acc = rank([...acc, ...list.filter(isOpenable)], q, null);
    onResults && onResults(acc);
  };
  // Fábricas: só as fontes do filtro escolhido são consultadas.
  const T = {
    hq: [() => searchArchive(q, 'hq', signal)],
    manga: [() => searchManga(q, signal)],
    book: [() => searchGutenberg(q, signal), () => searchArchive(q, 'book', signal), () => searchWikisource(q, signal), () => searchGithub(q, signal)],
    article: [() => searchArticles(q, signal), () => searchArxiv(q, signal)],
  };
  const tasks = (kind === 'all' ? Object.values(T).flat() : T[kind]).map((f) => f());

  let finished = 0;
  const step = () => onProgress && onProgress(++finished, tasks.length);
  const settled = await Promise.allSettled(
    tasks.map((t) => t.then((l) => { push(l); step(); return l; }, (e) => { step(); throw e; }))
  );
  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (settled.every((r) => r.status === 'rejected')) throw settled[0].reason;
  if (acc.length) cacheSet(key, acc);
  return acc;
}

// Em "Tudo", entende o que a pessoa procura: palavra-chave ("livro", "mangá", "artigo"…)
// restringe o tipo; senão busca em tudo e o tipo do melhor resultado vira a intenção (`onIntent`).
// Se a busca restrita não achar nada, tenta de novo em todas as categorias.
export async function search(query, kind, opts = {}) {
  const { onIntent } = opts;
  if (kind !== 'all') return runSearch(query, kind, opts);

  const intent = detectIntent(query);
  const kinds = intent.explicit ? intent.kind : 'all';
  onIntent && onIntent({ kind: intent.kind, query: intent.query });
  let out = await runSearch(intent.query, kinds, opts);
  if (!out.length && intent.explicit) out = await runSearch(query, 'all', opts);
  if (out.length && onIntent) onIntent({ kind: out[0].kind, query: intent.query, best: out[0] });
  return out;
}

// Descobre o melhor formato de um item do Internet Archive.
// Ordem: CBZ > EPUB > PDF > texto OCR (vira PDF) > leitor online incorporado.
export async function resolveArchive(identifier) {
  const meta = await getJson(`${IA}/metadata/${identifier}`);
  const files = meta.files || [];
  const find = (re) => files.find((f) => re.test(f.name) && !/_text\.pdf$/i.test(f.name) && !/encrypted|lcp/i.test(f.format || '') && !/_(lcp|encrypted)/i.test(f.name));
  const dl = (f) => `${IA}/download/${identifier}/${encodeURIComponent(f.name)}`;
  const cbz = find(/\.(cbz|cbr)$/i);
  if (cbz) return { type: cbz.name.toLowerCase().endsWith('.cbr') ? 'cbr' : 'cbz', url: dl(cbz) };
  const epub = find(/\.epub$/i);
  if (epub) return { type: 'epub', url: dl(epub) };
  const pdf = find(/\.pdf$/i);
  if (pdf) return { type: 'pdf', url: dl(pdf) };
  // Outros formatos: o app converte sozinho (FB2/DOCX/TXT no aparelho; MOBI/AZW3/DJVU no servidor).
  const other = find(/\.(fb2|mobi|azw3|docx|djvu)$/i);
  if (other) return { type: other.name.split('.').pop().toLowerCase(), url: dl(other) };
  const txt = files.find((f) => /_djvu\.txt$/i.test(f.name));
  if (txt) return { type: 'text', url: dl(txt) };
  return { type: 'embed', url: `${IA}/embed/${identifier}` };
}
