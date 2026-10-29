import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache em memória + AsyncStorage (localStorage na web) para buscas repetidas serem instantâneas.
const TTL = 1000 * 60 * 60 * 6;
const mem = new Map();

export async function cacheGet(key) {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  try {
    const raw = await AsyncStorage.getItem('rs:cache:' + key);
    if (raw) {
      const { t, v } = JSON.parse(raw);
      if (Date.now() - t < TTL) {
        mem.set(key, { t, v });
        return v;
      }
    }
  } catch {}
  return null;
}

export async function cacheSet(key, v) {
  const entry = { t: Date.now(), v };
  mem.set(key, entry);
  try {
    await AsyncStorage.setItem('rs:cache:' + key, JSON.stringify(entry));
  } catch {}
}

export async function clearCache() {
  mem.clear();
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('rs:cache:')));
}

const RECENT = 'rs:recent';
export async function getRecents() {
  try {
    return JSON.parse((await AsyncStorage.getItem(RECENT)) || '[]');
  } catch {
    return [];
  }
}
export async function addRecent(q) {
  const list = [q, ...(await getRecents()).filter((x) => x !== q)].slice(0, 8);
  await AsyncStorage.setItem(RECENT, JSON.stringify(list));
  return list;
}
export async function clearRecents() {
  await AsyncStorage.removeItem(RECENT);
}
