import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { resolveArchive } from '../api';
import { download, textToPdf, webToPdf } from '../files';
import { getEntry, saveToLibrary, updateProgress } from '../storage';
import PdfView from '../components/PdfView';
import CbzView from '../components/CbzView';
import EpubView from '../components/EpubView';
import EmbedView from '../components/EmbedView';
import { colors } from '../theme';

// Recebe `item` (resultado de busca) ou `entry` (já na biblioteca / arquivo local).
async function open({ item, entry }, setStatus) {
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

  setStatus('Baixando… (pode demorar para arquivos grandes)');
  const localUri = await download(src.url, `${item.id}.${src.type}`);
  return { ...base, localUri, fileType: src.type };
}

export default function ReaderScreen({ route, navigation }) {
  const [doc, setDoc] = useState(null);
  const [status, setStatus] = useState('Abrindo…');
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    open(route.params, setStatus)
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
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.muted, marginTop: 14 }}>{status}</Text>
      </View>
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
  if (doc.fileType === 'cbz' || doc.fileType === 'cbr') return <CbzView {...props} />;
  if (doc.fileType === 'epub') return <EpubView {...props} />;
  return <PdfView {...props} />;
}
