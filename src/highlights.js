import { Alert, Platform, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (bookId) => `rs:highlights:${bookId}`;

export async function getHighlights(bookId) {
  try {
    return JSON.parse((await AsyncStorage.getItem(key(bookId))) || '[]');
  } catch {
    return [];
  }
}

// Marca (on=true) ou desmarca um parágrafo identificado por capítulo + posição.
export async function setHighlight(bookId, { chapter, idx, text }, on) {
  const list = (await getHighlights(bookId)).filter((h) => !(h.chapter === chapter && h.idx === idx));
  if (on) list.push({ chapter, idx, text, at: Date.now() });
  await AsyncStorage.setItem(key(bookId), JSON.stringify(list));
  return list;
}

// Compartilha o trecho como citação (abre a folha de compartilhamento: WhatsApp, Instagram, X, etc.).
export async function shareQuote({ text, title, author }) {
  const quote = `“${text}”\n\n— ${title}${author ? `, ${author}` : ''}\nvia ReadSearch`;
  if (Platform.OS === 'web') {
    if (navigator.share) return navigator.share({ text: quote }).catch(() => {});
    await navigator.clipboard.writeText(quote);
    return window.alert('Citação copiada. Cole nas suas redes.');
  }
  try {
    await Share.share({ message: quote });
  } catch (e) {
    Alert.alert('Não foi possível compartilhar', e.message);
  }
}

// ---- Marca-texto: destaca trechos (letras/palavras) dentro de um parágrafo, com cor ----
const mkey = (bookId) => `rs:markers:${bookId}`;
export const MARKER_COLORS = ['#ffd16699', '#7bed9f99', '#ff9ff399', '#74b9ff99'];

export async function getMarkers(bookId) {
  try {
    return JSON.parse((await AsyncStorage.getItem(mkey(bookId))) || '[]');
  } catch {
    return [];
  }
}

export async function addMarker(bookId, marker) {
  const list = [...(await getMarkers(bookId)), marker];
  await AsyncStorage.setItem(mkey(bookId), JSON.stringify(list));
  return list;
}

export async function removeMarker(bookId, id) {
  const list = (await getMarkers(bookId)).filter((m) => m.id !== id);
  await AsyncStorage.setItem(mkey(bookId), JSON.stringify(list));
  return list;
}

// ---- Marcadores de página e notas de texto (valem para qualquer arquivo) ----
const pkey = (id) => `rs:pagemarks:${id}`;
const nkey = (id) => `rs:notes:${id}`;
const readList = async (k) => {
  try {
    return JSON.parse((await AsyncStorage.getItem(k)) || '[]');
  } catch {
    return [];
  }
};

export const getPageMarks = (id) => readList(pkey(id));
export async function togglePageMark(id, page) {
  const list = await getPageMarks(id);
  const next = list.includes(page) ? list.filter((p) => p !== page) : [...list, page].sort((a, b) => a - b);
  await AsyncStorage.setItem(pkey(id), JSON.stringify(next));
  return next;
}

export const getNotes = (id) => readList(nkey(id));
export async function addNote(id, note) {
  const list = [...(await getNotes(id)), { ...note, id: Date.now().toString(36), at: Date.now() }];
  await AsyncStorage.setItem(nkey(id), JSON.stringify(list));
  return list;
}
export async function removeNote(id, noteId) {
  const list = (await getNotes(id)).filter((n) => n.id !== noteId);
  await AsyncStorage.setItem(nkey(id), JSON.stringify(list));
  return list;
}
