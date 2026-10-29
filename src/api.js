import { cacheGet, cacheSet } from './cache';

// Busca em fontes abertas e gratuitas (sem chave de API):
//  - HQ / Livros: Internet Archive
//  - Livros: Project Gutenberg (Gutendex)
//  - Artigos: OpenAlex
export const KINDS = [
  { key: 'hq', label: 'HQ' },
  { key: 'book', label: 'Livros' },
  { key: 'article', label: 'Artigos' },
];

const IA = 'https://archive.org';

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Falha na busca (${res.status})`);
  return res.json();
}

// Remove caracteres especiais do Lucene que quebrariam a consulta.
const clean = (q) => q.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim();

async function searchArchive(query, kind, signal) {
  // Busca só em título/autor: ~4x mais rápida que a busca em texto completo.
  const t = clean(query);
  const scope =
    kind === 'hq'
      ? '(subject:comics OR collection:comics)'
      : 'NOT subject:comics';
  const q = `(title:(${t}) OR creator:(${t})) AND ${scope} AND mediatype:texts`;
  const url =
    `${IA}/advancedsearch.php?q=${encodeURIComponent(q)}` +
    '&fl[]=identifier&fl[]=title&fl[]=creator&rows=20&output=json&sort[]=downloads+desc';
  const data = await getJson(url, signal);
  return data.response.docs.map((d) => ({
    id: `ia:${d.identifier}`,
    title: d.title,
    author: Array.isArray(d.creator) ? d.creator.join(', ') : d.creator,
    cover: `${IA}/services/img/${d.identifier}`,
    kind,
    source: 'Internet Archive',
    resolve: { type: 'ia', identifier: d.identifier },
  }));
}

async function searchGutenberg(query, signal) {
  const data = await getJson(`https://gutendex.com/books/?search=${encodeURIComponent(query)}`, signal);
  return data.results.map((b) => {
    const f = b.formats;
    const html = f['text/html'] || f['text/html; charset=utf-8'];
    return {
      id: `pg:${b.id}`,
      title: b.title,
      author: b.authors.map((a) => a.name).join(', '),
      cover: f['image/jpeg'],
      kind: 'book',
      source: 'Project Gutenberg',
      resolve: html ? { type: 'web', url: html } : null,
    };
  }).filter((b) => b.resolve);
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

// Busca com cache e entrega progressiva: `onResults` recebe os resultados assim que
// cada fonte responde, sem esperar pela mais lenta. `signal` cancela buscas antigas.
export async function search(query, kind, { signal, onResults, onProgress } = {}) {
  const key = `${kind}:${query.toLowerCase()}`;
  const cached = await cacheGet(key);
  if (cached) {
    onResults && onResults(cached);
    return cached;
  }
  let acc = [];
  const push = (list) => {
    acc = [...acc, ...list];
    onResults && onResults(acc);
  };
  let tasks;
  if (kind === 'article') tasks = [searchArticles(query, signal)];
  else if (kind === 'book') tasks = [searchGutenberg(query, signal), searchArchive(query, 'book', signal)];
  else tasks = [searchArchive(query, 'hq', signal)];

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

// Descobre o melhor formato de um item do Internet Archive.
// Ordem: CBZ > EPUB > PDF > texto OCR (vira PDF) > leitor online incorporado.
export async function resolveArchive(identifier) {
  const meta = await getJson(`${IA}/metadata/${identifier}`);
  const files = meta.files || [];
  const find = (re) => files.find((f) => re.test(f.name) && !/_text\.pdf$/i.test(f.name));
  const dl = (f) => `${IA}/download/${identifier}/${encodeURIComponent(f.name)}`;
  const cbz = find(/\.(cbz|cbr)$/i);
  if (cbz) return { type: 'cbz', url: dl(cbz) };
  const epub = find(/\.epub$/i);
  if (epub) return { type: 'epub', url: dl(epub) };
  const pdf = find(/\.pdf$/i);
  if (pdf) return { type: 'pdf', url: dl(pdf) };
  const txt = files.find((f) => /_djvu\.txt$/i.test(f.name));
  if (txt) return { type: 'text', url: dl(txt) };
  return { type: 'embed', url: `${IA}/embed/${identifier}` };
}
