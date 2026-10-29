import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Device from 'expo-device';

export function fmtBytes(n) {
  if (n == null || isNaN(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}

async function appFilesSize() {
  const dir = FileSystem.documentDirectory;
  const names = await FileSystem.readDirectoryAsync(dir);
  let total = 0;
  for (const n of names) {
    const info = await FileSystem.getInfoAsync(dir + n);
    if (info.exists && info.size) total += info.size;
  }
  return total;
}

// Memória do aparelho: armazenamento (total/livre), RAM e espaço usado pelo app.
export async function getMemoryInfo() {
  if (Platform.OS === 'web') {
    const est = (navigator.storage && navigator.storage.estimate && (await navigator.storage.estimate())) || {};
    return {
      diskTotal: est.quota,
      diskFree: est.quota != null ? est.quota - (est.usage || 0) : null,
      ram: navigator.deviceMemory ? navigator.deviceMemory * 1024 ** 3 : null,
      appUsed: est.usage,
      model: navigator.platform || 'Navegador',
    };
  }
  const [diskTotal, diskFree, appUsed] = await Promise.all([
    FileSystem.getTotalDiskCapacityAsync(),
    FileSystem.getFreeDiskStorageAsync(),
    appFilesSize().catch(() => null),
  ]);
  return { diskTotal, diskFree, ram: Device.totalMemory, appUsed, model: Device.modelName || Device.deviceName };
}

export async function clearDownloads() {
  if (Platform.OS === 'web') return;
  const dir = FileSystem.documentDirectory;
  for (const n of await FileSystem.readDirectoryAsync(dir)) {
    await FileSystem.deleteAsync(dir + n, { idempotent: true });
  }
}
