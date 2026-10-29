import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'rs:catalogs';
export const CATALOG_COLORS = ['#3d8bff', '#4dd0ff', '#ffd166', '#3ddc97', '#48cae4', '#8e7bff', '#f06292'];

export async function getCatalogs() {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
  } catch {
    return [];
  }
}

const save = async (list) => {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  return list;
};

export async function createCatalog(name, color) {
  const list = await getCatalogs();
  return save([...list, { id: `cat:${Date.now()}`, name: name.trim(), color, itemIds: [] }]);
}

export async function updateCatalog(id, patch) {
  return save((await getCatalogs()).map((c) => (c.id === id ? { ...c, ...patch, name: (patch.name ?? c.name).trim() } : c)));
}

export async function deleteCatalog(id) {
  return save((await getCatalogs()).filter((c) => c.id !== id));
}

// Coloca ou tira um item de um catálogo.
export async function toggleInCatalog(catalogId, itemId) {
  return save(
    (await getCatalogs()).map((c) =>
      c.id !== catalogId ? c : { ...c, itemIds: c.itemIds.includes(itemId) ? c.itemIds.filter((x) => x !== itemId) : [...c.itemIds, itemId] }
    )
  );
}

export async function removeItemFromAll(itemId) {
  return save((await getCatalogs()).map((c) => ({ ...c, itemIds: c.itemIds.filter((x) => x !== itemId) })));
}

export async function removeItemsFromAll(itemIds) {
  const set = new Set(itemIds);
  return save((await getCatalogs()).map((c) => ({ ...c, itemIds: c.itemIds.filter((x) => !set.has(x)) })));
}
