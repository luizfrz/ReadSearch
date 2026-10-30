import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { KINDS, search } from '../api';
import { addRecent, clearRecents, getRecents } from '../cache';
import BookCard from '../components/BookCard';
import Skeleton from '../components/Skeleton';
import SearchProgress from '../components/SearchProgress';
import { colors, kindColors } from '../theme';

const SUGGESTIONS = { all: ['Batman', 'Dom Casmurro', 'One Piece', 'machine learning'], manga: ['One Piece', 'Naruto', 'Berserk', 'Dragon Ball'], hq: ['Batman', 'Spider-Man', 'Mafalda', 'Turma da Mônica'], book: ['Dom Casmurro', 'Dracula', 'Sherlock Holmes', 'Machado de Assis'], article: ['machine learning', 'climate change', 'neuroscience', 'quantum'] };

export default function SearchScreen({ navigation }) {
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recents, setRecents] = useState([]);
  const [intent, setIntent] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const ctrl = useRef(null);

  useEffect(() => { getRecents().then(setRecents); }, []);

  // Busca automática com debounce; cada nova digitação cancela a requisição anterior.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setIntent(null); setResults(null); setLoading(false); setError(null); return; }
    const t = setTimeout(async () => {
      ctrl.current && ctrl.current.abort();
      const c = (ctrl.current = new AbortController());
      setLoading(true);
      setError(null);
      setIntent(null);
      setProgress({ done: 0, total: 1 });
      try {
        const out = await search(q, kind, { signal: c.signal, onResults: (r) => !c.signal.aborted && setResults(r), onIntent: (i) => !c.signal.aborted && setIntent(i), onProgress: (done, total) => !c.signal.aborted && setProgress({ done, total }) });
        if (!c.signal.aborted) {
          setResults(out);
          addRecent(q).then(setRecents);
        }
      } catch (e) {
        if (e.name !== 'AbortError') { setError('Não foi possível buscar agora. Verifique sua conexão.'); setResults(null); }
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, kind]);

  const chips = (list, onPress) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {list.map((s) => (
        <Pressable key={s} onPress={() => onPress(s)} style={{ backgroundColor: colors.card, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text }}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );

  const header = (
    <View>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>
        Read<Text style={{ color: colors.accent }}>Search</Text>
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 14 }}>Encontre e leia o que quiser</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border }}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar HQ, livro ou artigo…"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
          style={{ flex: 1, color: colors.text, paddingVertical: 14, paddingHorizontal: 10, outlineStyle: 'none' }}
        />
        {query ? <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={20} color={colors.muted} /></Pressable> : null}
      </View>
      <View style={{ flexDirection: 'row', marginVertical: 14 }}>
        {KINDS.map((k) => {
          const on = kind === k.key;
          return (
            <Pressable key={k.key} onPress={() => setKind(k.key)} style={{ marginRight: 8 }}>
              <LinearGradient colors={on ? kindColors[k.key] : [colors.card, colors.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 20, borderWidth: on ? 0 : 1, borderColor: colors.border }}>
                <Text style={{ color: on ? '#fff' : colors.muted, fontWeight: '700' }}>{k.label}</Text>
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>Mostrando só o que o app consegue abrir (PDF, EPUB, CBZ, MOBI, DJVU, TXT…).</Text>
      <SearchProgress active={loading} done={progress.done} total={progress.total} label={`Buscando ${KINDS.find((k) => k.key === kind).label.toLowerCase()}…`} />
      {intent && intent.kind && kind === 'all' ? (
        <Text style={{ color: colors.muted, marginBottom: 10 }}>
          {intent.best ? 'Melhor resultado: ' : 'Procurando '}
          <Text style={{ color: colors.accent, fontWeight: '700' }}>{KINDS.find((k) => k.key === intent.kind).label}</Text>
          {intent.best ? ` · ${intent.best.title}` : ` · "${intent.query}"`}
        </Text>
      ) : null}
      {error ? <Text style={{ color: colors.danger, marginBottom: 10 }}>{error}</Text> : null}
    </View>
  );

  const empty = () => {
    if (loading) {
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ width: '50%', padding: 6 }}>
              <Skeleton style={{ aspectRatio: 2 / 3 }} />
              <Skeleton style={{ height: 12, marginTop: 8, borderRadius: 6 }} />
              <Skeleton style={{ height: 10, width: '60%', marginTop: 6, borderRadius: 5 }} />
            </View>
          ))}
        </View>
      );
    }
    if (results && !error) {
      return (
        <View style={{ alignItems: 'center', marginTop: 30, paddingHorizontal: 20 }}>
          <Ionicons name="search-outline" size={44} color={colors.muted} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center', marginTop: 12 }}>
            Não consegui localizar nada relacionado a "{query.trim()}".
          </Text>
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6 }}>
            Confira a grafia ou tente só o título ou o nome do autor.
          </Text>
          {kind !== 'all' ? (
            <Pressable onPress={() => setKind('all')} style={{ marginTop: 14, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Buscar em Tudo</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }
    return (
      <View>
        {recents.length ? (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Recentes</Text>
              <Pressable onPress={() => clearRecents().then(() => setRecents([]))}><Text style={{ color: colors.muted }}>Limpar</Text></Pressable>
            </View>
            {chips(recents, setQuery)}
          </View>
        ) : null}
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>Sugestões</Text>
        {chips(SUGGESTIONS[kind], setQuery)}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <FlatList
        data={results || []}
        key="grid"
        numColumns={2}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        initialNumToRender={8}
        windowSize={7}
        renderItem={({ item }) => <BookCard item={item} onPress={() => navigation.navigate('Reader', { item })} />}
      />
    </SafeAreaView>
  );
}
