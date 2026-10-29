import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { loadEpub, renderChapter } from '../epub';
import EpubControls from './EpubControls';
import { colors } from '../theme';

export default function EpubView({ uri, initialPage = 0, onPage }) {
  const [epub, setEpub] = useState(null);
  const [index, setIndex] = useState(initialPage);
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { loadEpub(uri).then(setEpub).catch((e) => setError(e.message)); }, [uri]);
  useEffect(() => {
    if (!epub) return;
    const i = Math.min(index, epub.chapters.length - 1);
    renderChapter(epub, i).then(setHtml).catch((e) => setError(e.message));
    onPage && onPage(i, epub.chapters.length);
  }, [epub, index]);

  if (error) return <Text style={{ color: colors.accent, padding: 20 }}>{error}</Text>;
  if (!epub || !html) return <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <iframe title="epub" srcDoc={html} style={{ flex: 1, width: '100%', border: 0 }} />
      <EpubControls index={index} total={epub.chapters.length} onPrev={() => setIndex(index - 1)} onNext={() => setIndex(index + 1)} />
    </View>
  );
}
