import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { buildEpub } from './epubBuilder';
import { LOCAL_CONVERT, NATIVE, SERVER_CONVERT } from './formats';
import { readBase64, readChunkBase64 } from './files';

const PROXY = process.env.EXPO_PUBLIC_PROXY_URL && process.env.EXPO_PUBLIC_PROXY_URL.replace(/\/$/, '');
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripTags = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const readText = async (uri) => {
  if (Platform.OS === 'web') return (await fetch(uri)).text();
  return FileSystem.readAsStringAsync(uri);
};

// ---------- texto / html / markdown / fb2 / docx  ->  capítulos HTML ----------

function textToChapters(text) {
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
  const chapters = [];
  let cur = null;
  const heading = /^(cap[ií]tulo|chapter|parte|part|livro|book)\b/i;
  for (const p of paras) {
    if (!cur || heading.test(p) || cur.count >= 80) {
      cur = { title: heading.test(p) ? p.slice(0, 60) : `Parte ${chapters.length + 1}`, html: '', count: 0 };
      chapters.push(cur);
    }
    cur.html += heading.test(p) ? `<h2>${esc(p)}</h2>` : `<p>${esc(p)}</p>`;
    cur.count++;
  }
  return chapters;
}

function htmlToChapters(html) {
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [null, html])[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const parts = body.split(/(?=<h[12][\s>])/i).filter((p) => stripTags(p));
  return (parts.length ? parts : [body]).map((p, i) => {
    const h = p.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
    return { title: h ? stripTags(h[1]).slice(0, 60) : `Parte ${i + 1}`, html: p };
  });
}

function markdownToHtml(md) {
  return md
    .split(/\n\s*\n/)
    .map((b) => {
      const h = b.match(/^(#{1,6})\s+(.*)/);
      if (h) return `<h${Math.min(h[1].length + 1, 4)}>${esc(h[2])}</h${Math.min(h[1].length + 1, 4)}>`;
      return `<p>${esc(b.replace(/\n/g, ' ')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>')}</p>`;
    })
    .join('');
}

function fb2ToChapters(xml) {
  const body = (xml.match(/<body[\s\S]*?<\/body>/i) || [xml])[0];
  return body.split(/<section[^>]*>/i).map((sec, i) => {
    const title = (sec.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
    const html = sec
      .replace(/<title>([\s\S]*?)<\/title>/gi, (_m, t) => `<h2>${esc(stripTags(t))}</h2>`)
      .replace(/<empty-line\s*\/>/gi, '<br/>')
      .replace(/<\/?(section|body|epigraph|cite|poem|stanza|annotation)[^>]*>/gi, '')
      .replace(/<(?!\/?(p|h2|br|emphasis|strong)\b)[^>]+>/gi, '')
      .replace(/<emphasis>/gi, '<i>').replace(/<\/emphasis>/gi, '</i>');
    return { title: title ? stripTags(title).slice(0, 60) : `Parte ${i + 1}`, html };
  }).filter((c) => stripTags(c.html));
}

async function docxToChapters(uri) {
  const zip = await JSZip.loadAsync(await readBase64(uri), { base64: true });
  const xml = await zip.file('word/document.xml').async('string');
  const chapters = [];
  let cur = null;
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
    const text = (p.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('').trim();
    if (!text) continue;
    const isHead = /<w:pStyle w:val="(Heading|Titulo|Título)[^"]*"/i.test(p);
    if (!cur || isHead) {
      cur = { title: isHead ? text.slice(0, 60) : `Parte ${chapters.length + 1}`, html: '' };
      chapters.push(cur);
    }
    cur.html += isHead ? `<h2>${esc(text)}</h2>` : `<p>${esc(text)}</p>`;
  }
  return chapters;
}

async function localToEpub({ uri, ext, id, title, author }) {
  let chapters;
  if (ext === 'docx') chapters = await docxToChapters(uri);
  else {
    const raw = await readText(uri);
    if (ext === 'fb2') chapters = fb2ToChapters(raw);
    else if (ext === 'md') chapters = htmlToChapters(markdownToHtml(raw));
    else if (ext === 'txt') chapters = textToChapters(raw);
    else chapters = htmlToChapters(raw);
  }
  if (!chapters || !chapters.length) throw new Error('Não foi possível extrair texto deste arquivo.');
  return buildEpub({ id, title, author, chapters });
}

// ---------- servidor de conversão (MOBI, AZW3, DJVU, CBR real...) ----------

async function serverConvert({ uri, ext, id }) {
  if (!PROXY) {
    throw new Error(`O formato ${ext.toUpperCase()} precisa do servidor de conversão. Rode "npm run proxy" (com Calibre/djvulibre/7z instalados) e defina EXPO_PUBLIC_PROXY_URL.`);
  }
  const to = SERVER_CONVERT[ext];
  const url = `${PROXY}/convert?from=${ext}&to=${to}`;
  if (Platform.OS === 'web') {
    const res = await fetch(url, { method: 'POST', body: await (await fetch(uri)).blob() });
    if (!res.ok) throw new Error(await res.text());
    return { uri: URL.createObjectURL(await res.blob()), type: to };
  }
  const up = await FileSystem.uploadAsync(url, uri, { httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT });
  if (up.status >= 300) throw new Error(JSON.parse(up.body || '{}').error || `Conversão falhou (${up.status})`);
  const { id: outId } = JSON.parse(up.body);
  const dest = FileSystem.documentDirectory + id.replace(/[^a-z0-9]+/gi, '_').slice(0, 80) + '.' + to;
  const dl = await FileSystem.downloadAsync(`${PROXY}/out/${outId}`, dest);
  if (dl.status >= 300) throw new Error('Não foi possível baixar o arquivo convertido.');
  return { uri: dest, type: to };
}

// CBR de verdade (RAR) começa com "Rar!"; muitos .cbr são ZIP renomeado e abrem direto.
async function isRealRar(uri) {
  if (Platform.OS === 'web') return false;
  try {
    return (await readChunkBase64(uri, 0, 6)).startsWith('UmFy');
  } catch {
    return false;
  }
}

// Garante que o arquivo esteja num formato que o app lê. Retorna { uri, type }.
export async function ensureReadable({ uri, ext, id, title, author }, setStatus = () => {}) {
  if (NATIVE.includes(ext)) return { uri, type: ext };
  if (ext === 'cbr' && !(await isRealRar(uri))) return { uri, type: 'cbz' };
  if (LOCAL_CONVERT.includes(ext)) {
    setStatus(`Convertendo ${ext.toUpperCase()} para EPUB…`);
    return { uri: await localToEpub({ uri, ext, id, title, author }), type: 'epub' };
  }
  if (SERVER_CONVERT[ext]) {
    setStatus(`Convertendo ${ext.toUpperCase()} para ${SERVER_CONVERT[ext].toUpperCase()}…`);
    return serverConvert({ uri, ext, id });
  }
  throw new Error(`Formato .${ext} não suportado.`);
}

// HTML puro (ex.: página da Wikisource) -> EPUB.
export function htmlToEpub({ html, id, title, author }) {
  return buildEpub({ id, title, author, chapters: htmlToChapters(html) });
}
export function textToEpub({ text, id, title, author }) {
  return buildEpub({ id, title, author, chapters: textToChapters(text) });
}
