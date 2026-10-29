import React, { useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useEpub } from '../useEpub';
import EpubControls from './EpubControls';
import HighlightBar from './HighlightBar';
import MarkerBar from './MarkerBar';
import { colors } from '../theme';

export default function EpubView(props) {
  const ref = useRef(null);
  const e = useEpub(props);
  const run = (js) => ref.current && ref.current.injectJavaScript(`${js};true;`);

  e.setAutoApply(run);

  if (e.error) return <Text style={{ color: colors.danger, padding: 20 }}>{e.error}</Text>;
  if (!e.epub || !e.html) return <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <WebView
        ref={ref}
        key={e.index}
        originWhitelist={['*']}
        source={{ html: e.html }}
        style={{ backgroundColor: colors.bg }}
        onMessage={(ev) => e.onMessage(ev.nativeEvent.data)}
      />
      {e.range || e.markSel ? (
        <MarkerBar range={e.range} onColor={(c) => e.applyMarker(c, run)} onErase={() => e.eraseMarker(run)} onClose={() => run('window.getSelection().removeAllRanges()')} />
      ) : e.selection ? (
        <HighlightBar marked={e.selection.marked} text={e.selection.text} title={props.title} author={props.author} onMark={() => e.toggleMark(run)} onShare={e.share} onClose={() => { run('window.__clear()'); e.clearSelection(); }} />
      ) : null}
      <EpubControls index={e.index} total={e.epub.chapters.length} onPrev={() => e.setIndex(e.index - 1)} onNext={() => e.setIndex(e.index + 1)} />
    </View>
  );
}
