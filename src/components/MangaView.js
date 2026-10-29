import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getChapterPages, getMangaChapters } from '../api';
import ImagePager from './ImagePager';
import VerticalPager from './VerticalPager';
import { getHighlights, setHighlight } from '../highlights';
import { shareRemoteImage } from '../share';
import { colors } from '../theme';

// Lista de capítulos do MangaDex; ao escolher um, abre as páginas.
// `initialPage`/`onPage` guardam o índice do último capítulo aberto.
export default function MangaView({ mangaId, initialPage = 0, onPage }) {
  const [vertical, setVertical] = useState(true); // padrão: leitura vertical
  const [marks, setMarks] = useState([]); // páginas marcadas (todos os capítulos)
  const [selected, setSelected] = useState(null);
  const [chapters, setChapters] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // { index, urls }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('rs:manga-vertical').then((v) => v === '0' && setVertical(false)).catch(() => {});
    getHighlights(`md:${mangaId}`).then(setMarks);
  }, [mangaId]);

  const toggleMode = () => {
    setVertical(!vertical);
    AsyncStorage.setItem('rs:manga-vertical', vertical ? '0' : '1').catch(() => {});
  };

  // Marca/desmarca a página selecionada do capítulo aberto.
  const toggleMark = async () => {
    const on = !marks.some((m) => m.chapter === open.index && m.idx === selected);
    setMarks(await setHighlight(`md:${mangaId}`, { chapter: open.index, idx: selected, text: `Pág. ${selected + 1}` }, on));
  };

  useEffect(() => { getMangaChapters(mangaId).then(setChapters).catch((e) => setError(e.message)); }, [mangaId]);

  const openChapter = async (index) => {
    setBusy(true);
    try {
      const urls = await getChapterPages(chapters[index].id);
      setSelected(null);
      setOpen({ index, urls });
      onPage && onPage(index, chapters.length);
    } catch (e) {
      setError('Não foi possível carregar este capítulo.');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Text style={{ color: colors.danger, padding: 20 }}>{error}</Text>;
  if (!chapters) return <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />;
  if (!chapters.length) {
    return <Text style={{ color: colors.muted, padding: 20 }}>Este mangá não tem capítulos disponíveis para leitura no MangaDex (podem existir apenas em sites oficiais externos).</Text>;
  }

  if (open) {
    const hasNext = open.index < chapters.length - 1;
    const chapterMarks = marks.filter((m) => m.chapter === open.index).map((m) => m.idx);
    const next = hasNext ? (
      <Pressable onPress={() => openChapter(open.index + 1)} style={{ margin: 20, padding: 16, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>Próximo capítulo →</Text>
      </Pressable>
    ) : <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>Fim dos capítulos disponíveis.</Text>;
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 8 }}>
          <Pressable onPress={() => setOpen(null)} style={{ padding: 6 }}><Ionicons name="list" size={22} color={colors.text} /></Pressable>
          <Text style={{ color: colors.text, flex: 1, textAlign: 'center', fontWeight: '700' }}>Capítulo {chapters[open.index].number || '—'}</Text>
          <Pressable onPress={toggleMode} style={{ padding: 6 }}>
            <Ionicons name={vertical ? 'swap-vertical' : 'swap-horizontal'} size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => hasNext && openChapter(open.index + 1)} disabled={!hasNext || busy} style={{ padding: 6, opacity: hasNext ? 1 : 0.3 }}>
            <Ionicons name="play-skip-forward" size={22} color={colors.text} />
          </Pressable>
        </View>
        {vertical ? (
          <VerticalPager key={`v${open.index}`} urls={open.urls} marks={chapterMarks} selected={selected} onSelect={setSelected} footer={next} />
        ) : (
          <ImagePager key={`h${open.index}`} urls={open.urls} />
        )}
        {vertical && selected != null ? (
          <View style={{ flexDirection: 'row', backgroundColor: colors.card2, borderTopWidth: 1, borderColor: colors.border }}>
            <Pressable onPress={toggleMark} style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
              <Ionicons name={chapterMarks.includes(selected) ? 'bookmark' : 'bookmark-outline'} size={20} color="#ffd166" />
              <Text style={{ color: '#ffd166', fontWeight: '700', fontSize: 11, marginTop: 2 }}>{chapterMarks.includes(selected) ? 'Desmarcar página' : 'Marcar página'}</Text>
            </Pressable>
            <Pressable onPress={() => shareRemoteImage(open.urls[selected])} style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
              <Ionicons name="logo-whatsapp" size={20} color="#3ddc97" />
              <Text style={{ color: '#3ddc97', fontWeight: '700', fontSize: 11, marginTop: 2 }}>Print / Status</Text>
            </Pressable>
            <Pressable onPress={() => setSelected(null)} style={{ padding: 14 }}><Ionicons name="close" size={20} color={colors.muted} /></Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={chapters}
        keyExtractor={(c) => c.id}
        initialScrollIndex={Math.min(initialPage, chapters.length - 1)}
        getItemLayout={(_, i) => ({ length: 58, offset: 58 * i, index: i })}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => openChapter(index)} style={{ height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: index === initialPage ? colors.card : 'transparent' }}>
            <Text style={{ color: colors.accent, fontWeight: '800', width: 56 }}>{item.number ? `#${item.number}` : '—'}</Text>
            <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{item.title || `Capítulo ${item.number || ''}`}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{item.lang === 'pt-br' ? 'PT' : 'EN'} · {item.pages}p</Text>
          </Pressable>
        )}
      />
      {busy ? <ActivityIndicator style={{ position: 'absolute', top: 20, alignSelf: 'center' }} color={colors.accent} /> : null}
    </View>
  );
}
