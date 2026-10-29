import React, { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { Platform, Pressable, Text, View } from 'react-native';
import { getWikisourceHtml, resolveArchive } from '../api';
import { download, fetchText, webToPdf } from '../files';
import { ensureReadable, htmlToEpub, textToEpub } from '../convert';
import { captureAndShare } from '../share';
import { getEntry, saveToLibrary, updateProgress } from '../storage';
import { MARKER_COLORS, addNote, getNotes, getPageMarks, removeNote, togglePageMark } from '../highlights';
import ReaderTools from '../components/ReaderTools';
import ReaderPanel from '../components/ReaderPanel';
import PdfView from '../components/PdfView';
import CbzView from '../components/CbzView';
import EpubView from '../components/EpubView';
import EmbedView from '../components/EmbedView';
import LoadingProgress from '../components/LoadingProgress';
import MangaView from '../components/MangaView';
import RepoFiles from '../components/RepoFiles';
import { colors } from '../theme';

// Recebe `item` (resultado de busca) ou `entry` (já na biblioteca / arquivo local).
async function open({ item, entry, local }, setStatus, setProgress) {
  if (entry) return entry;

  // Arquivo importado do aparelho: converte se o formato não for nativo.
  if (local) {
    const r = await ensureReadable({ uri: local.uri, ext: local.ext, id: local.id, title: local.title }, setStatus);
    return { id: local.id, title: local.title, localUri: r.uri, fileType: r.type, kind: local.kind, source: 'Arquivo local' };
  }

  setStatus('Localizando arquivo…');
  let src = item.resolve;
  if (src.type === 'ia') src = await resolveArchive(src.identifier);

  const base = { id: item.id, title: item.title, author: item.author, cover: item.cover, kind: item.kind, source: item.source };

  // Mangá (capítulos remotos) e repositório do GitHub (escolher o arquivo) não baixam nada aqui.
  if (src.type === 'manga') return { ...base, fileType: 'manga', mangaId: src.mangaId };
  if (src.type === 'github') return { printed: false, picker: src.repo, ...base, fileType: 'repo' };

  if (src.type === 'embed') return { ...base, fileType: 'embed', url: src.url };

  if (src.type === 'wikisource') {
    setStatus('Convertendo para EPUB…');
    const uri = await htmlToEpub({ html: await getWikisourceHtml(src.title), id: item.id, title: item.title, author: item.author });
    return { ...base, localUri: uri, fileType: 'epub' };
  }

  if (src.type === 'text') {
    setStatus('Convertendo texto para EPUB…');
    const uri = await textToEpub({ text: await fetchText(src.url), id: item.id, title: item.title, author: item.author });
    return { ...base, localUri: uri, fileType: 'epub' };
  }

  if (src.type === 'web') {
    setStatus(Platform.OS === 'web' ? 'Preparando PDF…' : 'Convertendo página em PDF…');
    const out = await webToPdf(src.url, item.title);
    if (out.printed) return { printed: true };
    return { ...base, localUri: out.uri, fileType: 'pdf' };
  }

  setStatus('Baixando…');
  setProgress({ value: 0, written: 0, total: 0 });
  const downloaded = await download(src.url, `${item.id}.${src.type}`, (value, written, total) => setProgress({ value, written, total }));
  setProgress(null);
  // Qualquer formato suportado vira PDF, EPUB ou CBZ, que são os que o app lê.
  const ready = await ensureReadable({ uri: downloaded, ext: src.type, id: item.id, title: item.title, author: item.author }, setStatus);
  return { ...base, localUri: ready.uri, fileType: ready.type };
}

export default function ReaderScreen({ route, navigation }) {
  const [doc, setDoc] = useState(null);
  const [status, setStatus] = useState('Abrindo…');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);
  const shot = useRef(null);
  const [pos, setPos] = useState(null);
  const bar = useRef(new Animated.Value(0)).current;
  const controlRef = useRef({}); // cada leitor registra goTo() e a seleção atual
  const [markerOn, setMarkerOn] = useState(false);
  const [color, setColor] = useState(MARKER_COLORS[0]);
  const [pageMarks, setPageMarks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [panel, setPanel] = useState(false);
  const [quote, setQuote] = useState('');

  useEffect(() => {
    if (!doc || doc.printed) return;
    getPageMarks(doc.id).then(setPageMarks);
    getNotes(doc.id).then(setNotes);
  }, [doc && doc.id]);

  useEffect(() => {
    let alive = true;
    open(route.params, setStatus, setProgress)
      .then(async (d) => {
        if (!alive) return;
        if (!d.printed && d.fileType !== 'repo') {
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
        <Text style={{ color: colors.danger, fontSize: 16, marginBottom: 16 }}>Não foi possível abrir: {error}</Text>
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
  const props = {
    uri: doc.localUri, initialPage: doc.page || 0, onPage, bookId: doc.id, title: doc.title, author: doc.author,
    marker: { on: markerOn, color }, controlRef,
  };
  if (doc.fileType === 'repo') {
    // Escolhido o arquivo, reabre o leitor tratando-o como um livro normal.
    return (
      <RepoFiles
        repo={doc.picker}
        onPick={(f) =>
          navigation.replace('Reader', {
            item: {
              id: `gh:${doc.picker}:${f.path}`, title: f.name, author: doc.picker, cover: doc.cover, kind: 'book',
              source: 'GitHub', resolve: { type: f.type, url: f.url },
            },
          })
        }
      />
    );
  }
  const type = doc.fileType === 'cbr' ? 'cbz' : doc.fileType;
  const reader =
    type === 'embed' ? <EmbedView uri={doc.url} /> :
    type === 'manga' ? <MangaView mangaId={doc.mangaId} initialPage={doc.page || 0} onPage={onPage} /> :
    type === 'cbz' ? <CbzView {...props} /> :
    type === 'epub' ? <EpubView {...props} /> :
    <PdfView {...props} />;

  // O que cada tipo de arquivo permite (mangá tem marcação própria de páginas; embed/PDF web só print).
  const full = type === 'cbz' || type === 'epub' || (type === 'pdf' && Platform.OS !== 'web');
  const can = { print: true, mark: full, color: full, notes: full };
  const page = pos ? pos.page : 0;
  const pageMarked = pageMarks.includes(page);

  const tools = {
    print: () => captureAndShare(shot).catch(() => {}),
    mark: async () => setPageMarks(await togglePageMark(doc.id, page)),
    toggleColor: () => setMarkerOn(!markerOn),
    pickColor: setColor,
    notes: () => { setQuote(controlRef.current.selection || ''); setPanel(true); },
  };

  const width = bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: 4, backgroundColor: colors.card2 }}>
        <Animated.View style={{ width, height: '100%', backgroundColor: colors.accent }} />
      </View>
      <View ref={shot} collapsable={false} style={{ flex: 1 }}>{reader}</View>
      {pos && pos.total > 1 ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
            {pos.page + 1}/{pos.total} · {Math.round(((pos.page + 1) / pos.total) * 100)}%
          </Text>
        </View>
      ) : null}
      <ReaderTools can={can} state={{ pageMarked, colorOn: markerOn, color }} on={tools} />
      <ReaderPanel
        visible={panel}
        page={page}
        label={type === 'epub' ? 'Capítulo' : 'Página'}
        quote={quote}
        notes={notes}
        pageMarks={pageMarks}
        onAdd={async (text) => { setNotes(await addNote(doc.id, { page, quote, text })); setQuote(''); }}
        onDeleteNote={async (id) => setNotes(await removeNote(doc.id, id))}
        onGoTo={(n) => controlRef.current.goTo && controlRef.current.goTo(n)}
        onToggleMark={async (n) => setPageMarks(await togglePageMark(doc.id, n))}
        onClose={() => setPanel(false)}
      />
    </View>
  );
}
