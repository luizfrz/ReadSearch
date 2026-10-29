import React, { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { Platform, Pressable, Text, View } from 'react-native';
import { resolveArchive } from '../api';
import { download, textToPdf, webToPdf } from '../files';
import { getEntry, saveToLibrary, updateProgress } from '../storage';
import PdfView from '../components/PdfView';
import CbzView from '../components/CbzView';
import EpubView from '../components/EpubView';
import EmbedView from '../components/EmbedView';
import LoadingProgress from '../components/LoadingProgress';
import { colors } from '../theme';

// Recebe `item` (resultado de busca) ou `entry` (já na biblioteca / arquivo local).
async function open({ item, entry }, setStatus, setProgress) {
  if (entry) return entry;

  setStatus('Localizando arquivo…');
  let src = item.resolve;
  if (src.type === 'ia') src = await resolveArchive(src.identifier);

  const base = { id: item.id, title: item.title, author: item.author, cover: item.cover, kind: item.kind, source: item.source };

  if (src.type === 'embed') return { ...base, fileType: 'embed', url: src.url };

  if (src.type === 'web' || src.type === 'text') {
    setStatus(Platform.OS === 'web' ? 'Preparando PDF…' : 'Convertendo em PDF…');
    const out = src.type === 'web' ? await webToPdf(src.url, item.title) : await textToPdf(src.url, item.title);
    if (out.printed) return { printed: true };
    return { ...base, localUri: out.uri, fileType: 'pdf' };
  }

  setStatus('Baixando…');
  setProgress({ value: 0, written: 0, total: 0 });
  const localUri = await download(src.url, `${item.id}.${src.type}`, (value, written, total) => setProgress({ value, written, total }));
  setProgress(null);
  return { ...base, localUri, fileType: src.type };
}

export default function ReaderScreen({ route, navigation }) {
  const [doc, setDoc] = useState(null);
  const [status, setStatus] = useState('Abrindo…');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);
  const [pos, setPos] = useState(null);
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    open(route.params, setStatus, setProgress)
      .then(async (d) => {
        if (!alive) return;
        if (!d.printed) {
          // Retoma de onde parou, mesmo abrindo pela busca.
          const saved = await getEntry(d.id);
          d = { ...d, page: saved ? saved.page : d.page, total: saved ? saved.total : d.total };
          navigation.setOptions({ title: d.title });
          if (Platform.OS !== 'web' || !d.localUri?.startsWith('blob:')) saveToLibrary({ ...d, openedAt: Date.now() });
        }
        setDoc(d);
      })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; clearTimeout(timer.current); };
  }, [route.params]);

  // Grava a posição com debounce para não escrever a cada rolagem.
  const onPage = (page, total) => {
    if (!doc) return;
    const frac = total > 1 ? (page + 1) / total : 1;
    setPos({ page, total });
    Animated.timing(bar, { toValue: frac, duration: 250, useNativeDriver: false }).start();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => updateProgress(doc.id, page, total), 600);
  };

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: colors.accent, fontSize: 16, marginBottom: 16 }}>Não foi possível abrir: {error}</Text>
        <Pressable onPress={() => navigation.goBack()}><Text style={{ color: colors.text }}>← Voltar</Text></Pressable>
      </View>
    );
  }
  if (!doc) {
    const title = route.params.item ? route.params.item.title : route.params.entry.title;
    return (
      <LoadingProgress
        title={title}
        status={progress ? 'Baixando arquivo…' : status}
        progress={progress ? progress.value : null}
        written={progress && progress.written}
        total={progress && progress.total}
      />
    );
  }
  if (doc.printed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>
          Na web, a página foi enviada para impressão: escolha "Salvar como PDF" no diálogo do navegador.
        </Text>
      </View>
    );
  }
  const props = { uri: doc.localUri, initialPage: doc.page || 0, onPage };
  if (doc.fileType === 'embed') return <EmbedView uri={doc.url} />;
  const reader =
    doc.fileType === 'cbz' || doc.fileType === 'cbr' ? <CbzView {...props} /> :
    doc.fileType === 'epub' ? <EpubView {...props} /> :
    <PdfView {...props} />;
  const width = bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: 4, backgroundColor: colors.card2 }}>
        <Animated.View style={{ width, height: '100%', backgroundColor: colors.accent }} />
      </View>
      <View style={{ flex: 1 }}>{reader}</View>
      {pos && pos.total > 1 ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
            {pos.page + 1}/{pos.total} · {Math.round(((pos.page + 1) / pos.total) * 100)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}
