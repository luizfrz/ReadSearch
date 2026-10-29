import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { fileSize, readChunkBase64 } from '../files';
import { addMarker, getMarkers, removeMarker } from '../highlights';
import MarkerBar from './MarkerBar';
import pdfViewerHtml from './pdfViewerHtml';
import { colors } from '../theme';

const CHUNK = 3 * 256 * 1024; // múltiplo de 3 => base64 sem padding no meio

export default function PdfView({ uri, initialPage = 0, onPage, bookId, marker, controlRef }) {
  const ref = useRef(null);
  const html = useMemo(() => pdfViewerHtml(), []);
  const sending = useRef(false);
  const [range, setRange] = useState(null);
  const [markSel, setMarkSel] = useState(null);
  const markerRef = useRef(marker);
  markerRef.current = marker;
  const key = `pdf:${bookId}`;

  const run = (js) => ref.current && ref.current.injectJavaScript(`${js};true;`);

  useEffect(() => {
    if (controlRef) controlRef.current = { ...controlRef.current, goTo: (n) => run(`window.__goto(${n})`) };
  }, []);

  // O arquivo é enviado ao visor em pedaços; nunca fica inteiro em memória no lado React Native.
  const send = async () => {
    if (sending.current) return;
    sending.current = true;
    const size = await fileSize(uri);
    run(`window.__start(${size},${initialPage})`);
    for (let pos = 0; pos < size; pos += CHUNK) {
      run(`window.__chunk("${await readChunkBase64(uri, pos, Math.min(CHUNK, size - pos))}")`);
    }
    run('window.__end()');
    run(`window.__marks(${JSON.stringify(await getMarkers(key))})`);
  };

  const apply = async (r, color) => {
    const m = { id: Date.now().toString(36), page: r.page, rects: r.rects, color, text: r.text };
    await addMarker(key, m);
    run(`window.__addmark(${JSON.stringify(m)})`);
    setRange(null);
  };

  const onMessage = (e) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.t === 'ready') send();
    else if (m.t === 'page') onPage && onPage(m.page, m.total);
    else if (m.t === 'range') {
      if (controlRef) controlRef.current.selection = m.text;
      // Com o marca-texto ligado, o trecho selecionado já recebe a cor escolhida.
      if (markerRef.current && markerRef.current.on) apply(m, markerRef.current.color);
      else { setRange(m); setMarkSel(null); }
    } else if (m.t === 'rangeClear') { setRange(null); if (controlRef) controlRef.current.selection = ''; }
    else if (m.t === 'mark') { setMarkSel(m.id); setRange(null); }
  };

  const erase = async () => {
    await removeMarker(key, markSel);
    run(`window.__unmark(${JSON.stringify(markSel)})`);
    setMarkSel(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <WebView ref={ref} originWhitelist={['*']} source={{ html }} javaScriptEnabled onMessage={onMessage} />
      {range || markSel ? (
        <MarkerBar range={range} onColor={(c) => apply(range, c)} onErase={erase} onClose={() => { setMarkSel(null); run('window.getSelection().removeAllRanges()'); }} />
      ) : null}
    </View>
  );
}
