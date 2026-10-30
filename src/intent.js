// Entende o que o usuário quer buscar: normaliza o texto, detecta o tipo (livro, HQ, mangá,
// artigo) por palavras-chave e ordena os resultados por relevância.
export const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const STOP = new Set(['de', 'do', 'da', 'dos', 'das', 'o', 'a', 'os', 'as', 'e', 'em', 'the', 'of', 'and', 'an', 'in', 'on']);

export function tokens(q) {
  const all = norm(q).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const sig = all.filter((t) => !STOP.has(t) && t.length > 1);
  return sig.length ? sig : all;
}

// Palavra-chave explícita => tipo. A palavra é removida dos termos de busca.
const KEYWORDS = [
  ['manga', /\b(manga|mangas|manhwa|manhua|scan|scans)\b/],
  ['hq', /\b(hq|hqs|quadrinho|quadrinhos|comic|comics|gibi|gibis|graphic novel)\b/],
  ['article', /\b(artigo|artigos|paper|papers|article|articles|journal|arxiv|estudo cientifico|tese|dissertacao)\b/],
  ['book', /\b(livro|livros|romance|romances|novela|poema|poemas|ebook|epub|book|books)\b/],
];

// Palavras fortes que indicam o tipo mesmo sem palavra-chave.
const HINTS = [
  ['hq', /\b(batman|superman|spider[- ]?man|homem[- ]aranha|x[- ]?men|vingadores|avengers|turma da monica|mafalda|asterix|tintim|watchmen|sandman)\b/],
  ['manga', /\b(one piece|naruto|berserk|dragon ball|bleach|attack on titan|shingeki|death note|chainsaw man|jujutsu)\b/],
  ['article', /\b(machine learning|deep learning|neural network|quantum|neuroscience|climate change|covid|genom\w*|algorithm\w*)\b/],
];

export function detectIntent(query) {
  const n = norm(query);
  for (const [kind, re] of KEYWORDS) {
    if (re.test(n)) {
      const rest = n.replace(re, ' ').replace(/\s+/g, ' ').trim();
      if (rest.length >= 2) return { kind, query: rest, explicit: true };
    }
  }
  for (const [kind, re] of HINTS) if (re.test(n)) return { kind, query: query.trim(), explicit: false };
  return { kind: null, query: query.trim(), explicit: false };
}

// 0..~2: fração de termos achados em título/autor + bônus por frase exata / começo do título.
export function relevance(item, terms, phrase) {
  if (!terms.length) return 1;
  const title = norm(item.title || '');
  const hay = title + ' ' + norm(item.author || '');
  const found = terms.filter((t) => hay.includes(t)).length / terms.length;
  let s = found;
  if (phrase && title.includes(phrase)) s += 0.6;
  if (phrase && title.startsWith(phrase)) s += 0.4;
  return s;
}

// Fontes que buscam por título alternativo/idioma e por isso não podem ser filtradas por texto.
const TRUSTED = (it) => it.kind === 'manga' || /github/i.test(it.source || '');

export function rank(items, query, preferKind) {
  const terms = tokens(query);
  const phrase = norm(query).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const seen = new Set();
  return items
    .map((it) => ({ it, s: relevance(it, terms, phrase) + (preferKind && it.kind === preferKind ? 0.15 : 0) }))
    .filter(({ it, s }) => TRUSTED(it) || s > 0)
    .filter(({ it }) => {
      const k = norm(it.title || '') + '|' + it.kind;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.s - a.s)
    .map(({ it }) => it);
}
