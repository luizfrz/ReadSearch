import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

function downloadOnWeb(href, name) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

// Abre a folha de compartilhamento com a imagem (WhatsApp > Status, Instagram, etc.).
export async function shareImageFile(uri, name = 'readsearch.png', mimeType = 'image/png') {
  if (Platform.OS === 'web') return downloadOnWeb(uri, name);
  if (!(await Sharing.isAvailableAsync())) return Alert.alert('Compartilhamento indisponível neste aparelho.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Compartilhar' });
}

// "Tira o print" de uma view (ref) e compartilha. `size` fixa a resolução final (ex.: 1080x1920).
export async function captureAndShare(ref, size) {
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
    ...(size || {}),
  });
  await shareImageFile(uri);
}

// Compartilha uma imagem remota (página de mangá): baixa para o cache e abre o compartilhamento.
export async function shareRemoteImage(url) {
  if (Platform.OS === 'web') return window.open(url, '_blank');
  const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
  const dest = `${FileSystem.cacheDirectory}page_${Date.now()}.${ext}`;
  const res = await FileSystem.downloadAsync(url, dest);
  await shareImageFile(res.uri, `pagina.${ext}`, ext === 'png' ? 'image/png' : 'image/jpeg');
}
