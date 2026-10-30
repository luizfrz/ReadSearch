import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
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

// "Tira o print" de uma view (ref) e devolve o arquivo da imagem. `size` fixa a resolução (ex.: 1080x1920).
export function captureToFile(ref, size) {
  return captureRef(ref, { format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile', ...(size || {}) });
}

export async function captureAndShare(ref, size) {
  await shareImageFile(await captureToFile(ref, size));
}

// Envia a imagem direto para o WhatsApp (Android abre o app com a imagem; lá, "Meu status" fica no topo).
// Sem WhatsApp instalado, iOS ou web: cai na folha de compartilhamento comum.
export async function shareToWhatsApp(uri, name = 'pagina.jpg', mimeType = 'image/jpeg') {
  if (Platform.OS === 'android') {
    try {
      const stream = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.SEND', {
        type: mimeType,
        packageName: 'com.whatsapp',
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        extra: { 'android.intent.extra.STREAM': stream },
      });
      return;
    } catch {
      /* WhatsApp ausente: usa o compartilhamento padrão */
    }
  }
  await shareImageFile(uri, name, mimeType);
}

// Compartilha uma imagem remota (página de mangá): baixa para o cache e abre o compartilhamento.
export async function shareRemoteImage(url) {
  if (Platform.OS === 'web') return window.open(url, '_blank');
  const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
  const dest = `${FileSystem.cacheDirectory}page_${Date.now()}.${ext}`;
  const res = await FileSystem.downloadAsync(url, dest);
  await shareToWhatsApp(res.uri, `pagina.${ext}`, ext === 'png' ? 'image/png' : 'image/jpeg');
}
