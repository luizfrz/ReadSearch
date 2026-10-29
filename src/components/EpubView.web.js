import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useEpub } from '../useEpub';
import EpubControls from './EpubControls';
import HighlightBar from './HighlightBar';
import MarkerBar from './MarkerBar';
import { colors } from '../theme';

export default function EpubView(props) {
  const frame = useRef(null);
  const e = useEpub(props);
  const run = (js) => {
    const w = frame.current && frame.current.contentWindow;
    if (w) w.eval(js);
  };

  useEffect(() => {
    const on = (ev) => ev.data && ev.data.rs && e.onMessage(ev.data.rs);
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  });

  e.setAutoApply(run);

  if (e.error) return <Text style={{ color: colors.danger, padding: 20 }}>{e.error}</Text>;
  if (!e.epub || !e.html) return <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <iframe ref={frame} title="epub" srcDoc={e.html} style={{ flex: 1, width: '100%', border: 0 }} />
      {e.range || e.markSel ? (
        <MarkerBar range={e.range} onColor={(c) => e.applyMarker(c, run)} onErase={() => e.eraseMarker(run)} onClose={() => run('window.getSelection().removeAllRanges()')} />
      ) : e.selection ? (
        <HighlightBar marked={e.selection.marked} text={e.selection.text} title={props.title} author={props.author} onMark={() => e.toggleMark(run)} onShare={e.share} onClose={() => { run('window.__clear()'); e.clearSelection(); }} />
      ) : null}
      <EpubControls index={e.index} total={e.epub.chapters.length} onPrev={() => e.setIndex(e.index - 1)} onNext={() => e.setIndex(e.index + 1)} />
    </View>
  );
}
