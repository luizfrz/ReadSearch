import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';

// Proxy próprio (npm run proxy) via EXPO_PUBLIC_PROXY_URL; sem ele, cai num proxy público.
const OWN_PROXY = process.env.EXPO_PUBLIC_PROXY_URL;
const proxied = (url) =>
  OWN_PROXY
    ? `${OWN_PROXY.replace(/\/$/, '')}/fetch?url=${encodeURIComponent(url)}`
    : `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
const safe = (s) => s.replace(/[^a-z0-9]+/gi, '_').slice(0, 80);

// Baixa um arquivo remoto (cache em disco no mobile; URL direta na web).
// `onProgress(fração, bytesBaixados, bytesTotais)` é chamado durante o download.
export async function download(url, name, onProgress) {
  if (Platform.OS === 'web') return url;
  const dest = FileSystem.documentDirectory + safe(name);
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest;
  const task = FileSystem.createDownloadResumable(url, dest, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
    if (onProgress && totalBytesExpectedToWrite > 0) {
      onProgress(totalBytesWritten / totalBytesExpectedToWrite, totalBytesWritten, totalBytesExpectedToWrite);
    }
  });
  const res = await task.downloadAsync();
  if (!res || res.status >= 400) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new Error(`Download falhou (${res ? res.status : 'sem resposta'})`);
  }
  return dest;
}

export async function fetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return await res.text();
  } catch (e) {
    if (Platform.OS !== 'web') throw e;
    const res = await fetch(proxied(url));
    if (!res.ok) throw new Error('Não foi possível acessar a página.');
    return res.text();
  }
}

function cleanHtml(html, url) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  const head = `<base href="${url}"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    '<style>img{max-width:100%;height:auto}body{font-family:Georgia,serif;line-height:1.5;margin:24px}</style>';
  return /<head[^>]*>/i.test(stripped)
    ? stripped.replace(/<head[^>]*>/i, (m) => m + head)
    : `<head>${head}</head>${stripped}`;
}

// Gera PDF a partir de HTML pronto.
// Mobile: retorna o arquivo. Web: abre o diálogo de impressão ("Salvar como PDF").
export async function htmlToPdf(html, title) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return { printed: true };
  }
  const { uri } = await Print.printToFileAsync({ html });
  const dest = FileSystem.documentDirectory + safe(title || 'documento') + '.pdf';
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: dest });
  return { uri: dest };
}

// Transforma uma página web em PDF.
export async function webToPdf(url, title) {
  return htmlToPdf(cleanHtml(await fetchText(url), url), title);
}

const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Texto puro (OCR do Internet Archive) -> PDF legível.
export async function textToPdf(url, title) {
  const raw = await fetchText(url);
  const paras = raw.split(/\n\s*\n/).map((p) => `<p>${escapeHtml(p.replace(/\n/g, ' ').trim())}</p>`).join('');
  const html = `<html><head><meta charset="utf-8"><style>body{font-family:Georgia,serif;line-height:1.6;margin:32px}p{margin:0 0 12px}</style></head><body><h1>${escapeHtml(title)}</h1>${paras}</body></html>`;
  return htmlToPdf(html, title);
}

export async function fileSize(uri) {
  const info = await FileSystem.getInfoAsync(uri);
  return info.size || 0;
}

// Lê um trecho do arquivo em base64 (position/length em bytes) sem carregar o arquivo todo.
export function readChunkBase64(uri, position, length) {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, position, length });
}

export async function readBase64(uri) {
  if (Platform.OS === 'web') {
    const buf = await (await fetch(uri)).arrayBuffer();
    let bin = '';
    new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
