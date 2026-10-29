import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'readgreat:library';

export async function getLibrary() {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
  } catch {
    return [];
  }
}

export async function saveToLibrary(entry) {
  const lib = await getLibrary();
  const next = [entry, ...lib.filter((i) => i.id !== entry.id)];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function removeFromLibrary(id) {
  const lib = await getLibrary();
  await AsyncStorage.setItem(KEY, JSON.stringify(lib.filter((i) => i.id !== id)));
}

// Salva a posição de leitura (página/capítulo) de um item da biblioteca.
export async function updateProgress(id, page, total) {
  const lib = await getLibrary();
  const i = lib.findIndex((x) => x.id === id);
  if (i < 0) return;
  lib[i] = { ...lib[i], page, total };
  await AsyncStorage.setItem(KEY, JSON.stringify(lib));
}

export async function getEntry(id) {
  return (await getLibrary()).find((x) => x.id === id) || null;
}

export async function removeManyFromLibrary(ids) {
  const set = new Set(ids);
  const lib = await getLibrary();
  await AsyncStorage.setItem(KEY, JSON.stringify(lib.filter((i) => !set.has(i.id))));
}
