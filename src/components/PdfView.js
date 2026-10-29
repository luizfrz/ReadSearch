import React, { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { fileSize, readChunkBase64 } from '../files';
import pdfViewerHtml from './pdfViewerHtml';
import { colors } from '../theme';

const CHUNK = 3 * 256 * 1024; // múltiplo de 3 => base64 sem padding no meio

export default function PdfView({ uri, initialPage = 0, onPage }) {
  const ref = useRef(null);
  const html = useMemo(() => pdfViewerHtml(), []);
  const sending = useRef(false);

  // O arquivo é enviado ao visor em pedaços; nunca fica inteiro em memória no lado React Native.
  const send = async () => {
    if (sending.current) return;
    sending.current = true;
    const size = await fileSize(uri);
    ref.current.injectJavaScript(`window.__start(${size},${initialPage});true;`);
    for (let pos = 0; pos < size; pos += CHUNK) {
      const b64 = await readChunkBase64(uri, pos, Math.min(CHUNK, size - pos));
      ref.current.injectJavaScript(`window.__chunk("${b64}");true;`);
    }
    ref.current.injectJavaScript('window.__end();true;');
  };

  const onMessage = (e) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.ready) send();
    else if (m.total && onPage) onPage(m.page, m.total);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <WebView ref={ref} originWhitelist={['*']} source={{ html }} javaScriptEnabled onMessage={onMessage} />
    </View>
  );
}
