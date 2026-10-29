import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import BookCard from '../components/BookCard';
import { getLibrary, removeFromLibrary, removeManyFromLibrary } from '../storage';
import { READABLE, extOf } from '../formats';
import CatalogModal from '../components/CatalogModal';
import ItemSheet from '../components/ItemSheet';
import { createCatalog, deleteCatalog, getCatalogs, removeItemFromAll, removeItemsFromAll, toggleInCatalog, updateCatalog } from '../catalogs';
import { colors } from '../theme';

export default function LibraryScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' ou id do catálogo
  const [sheetItem, setSheetItem] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(new Set());
  const [editor, setEditor] = useState({ open: false, catalog: null });
  const load = useCallback(() => {
    getLibrary().then(setItems);
    getCatalogs().then(setCatalogs);
  }, []);
  useFocusEffect(load);

  const importFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled) return;
    const f = res.assets[0];
    const ext = extOf(f.name);
    if (!READABLE.includes(ext)) return Alert.alert('Formato não suportado', `Formatos aceitos: ${READABLE.join(', ').toUpperCase()}.`);
    let uri = f.uri;
    if (Platform.OS !== 'web') {
      uri = FileSystem.documentDirectory + Date.now() + '_' + f.name.replace(/\s+/g, '_');
      await FileSystem.copyAsync({ from: f.uri, to: uri });
    }
    navigation.navigate('Reader', {
      local: { id: `local:${f.name}:${f.size}`, title: f.name.replace(/\.\w+$/, ''), uri, ext, kind: ['cbz', 'cbr', 'djvu'].includes(ext) ? 'hq' : 'book' },
    });
  };

  const remove = (item) => {
    const go = async () => {
      await removeFromLibrary(item.id);
      await removeItemFromAll(item.id);
      setSheetItem(null);
      load();
    };
    if (Platform.OS === 'web') return window.confirm(`Remover "${item.title}"?`) && go();
    Alert.alert('Remover', `Tirar "${item.title}" da biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: go },
    ]);
  };

  const saveCatalog = async (name, color) => {
    const { catalog } = editor;
    setCatalogs(catalog ? await updateCatalog(catalog.id, { name, color }) : await createCatalog(name, color));
    setEditor({ open: false, catalog: null });
  };

  const removeCatalog = async (catalog) => {
    const go = async () => {
      setCatalogs(await deleteCatalog(catalog.id));
      if (filter === catalog.id) setFilter('all');
      setEditor({ open: false, catalog: null });
    };
    if (Platform.OS === 'web') return window.confirm(`Excluir o catálogo "${catalog.name}"? Os itens continuam na biblioteca.`) && go();
    Alert.alert('Excluir catálogo', `Os itens de "${catalog.name}" continuam na biblioteca.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: go },
    ]);
  };

  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };
  const togglePick = (id) => setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Apaga os itens marcados da biblioteca, dos catálogos e os arquivos baixados do aparelho.
  const removePicked = () => {
    const ids = [...picked];
    const go = async () => {
      if (Platform.OS !== 'web') {
        for (const it of items.filter((i) => picked.has(i.id))) {
          if (it.localUri && it.localUri.startsWith(FileSystem.documentDirectory)) {
            await FileSystem.deleteAsync(it.localUri, { idempotent: true }).catch(() => {});
          }
        }
      }
      await removeManyFromLibrary(ids);
      await removeItemsFromAll(ids);
      stopSelecting();
      load();
    };
    const msg = `Excluir ${ids.length} ${ids.length === 1 ? 'item' : 'itens'} e os arquivos baixados?`;
    if (Platform.OS === 'web') return window.confirm(msg) && go();
    Alert.alert('Excluir', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: go },
    ]);
  };

  const active = catalogs.find((c) => c.id === filter);
  const shown = active ? items.filter((i) => active.itemIds.includes(i.id)) : items;

  const chip = (key, label, color, on, onPress, onLong) => (
    <Pressable key={key} onPress={onPress} onLongPress={onLong} style={{ marginRight: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: on ? color : colors.card, borderWidth: 1, borderColor: on ? color : colors.border }}>
      {!on && color !== colors.accent ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} /> : null}
      <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>Biblioteca</Text>
        {shown.length ? (
          <Pressable onPress={selecting ? stopSelecting : () => setSelecting(true)} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: selecting ? colors.accent : colors.card, borderWidth: 1, borderColor: selecting ? colors.accent : colors.border }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{selecting ? 'Cancelar' : 'Selecionar'}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ color: colors.muted, marginBottom: 14 }}>{shown.length} {shown.length === 1 ? 'item' : 'itens'} · toque e segure para organizar</Text>
      <Pressable onPress={importFile} style={{ marginBottom: 14 }}>
        <LinearGradient colors={[colors.accent, colors.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 8 }}>Importar arquivo (PDF, EPUB, CBZ, MOBI…)</Text>
        </LinearGradient>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {chip('all', `Todos (${items.length})`, colors.accent, filter === 'all', () => setFilter('all'))}
        {catalogs.map((c) => chip(c.id, `${c.name} (${c.itemIds.length})`, c.color, filter === c.id, () => setFilter(c.id), () => setEditor({ open: true, catalog: c })))}
        <Pressable onPress={() => setEditor({ open: true, catalog: null })} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.muted }}>
          <Ionicons name="add" size={16} color={colors.muted} />
          <Text style={{ color: colors.muted, fontWeight: '700', marginLeft: 4 }}>Catálogo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <FlatList
        data={shown}
        numColumns={2}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="library-outline" size={56} color={colors.border} />
            <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>
              {active ? 'Este catálogo está vazio.\nSegure um item da biblioteca para adicioná-lo.' : 'Sua biblioteca está vazia.\nBusque algo ou importe um arquivo.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <BookCard
            item={item}
            selecting={selecting}
            checked={picked.has(item.id)}
            onPress={() => (selecting ? togglePick(item.id) : navigation.navigate('Reader', { entry: item }))}
            onLongPress={() => (selecting ? togglePick(item.id) : setSheetItem(item))}
          />
        )}
      />
      {selecting ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border }}>
          <Pressable onPress={() => setPicked(picked.size === shown.length ? new Set() : new Set(shown.map((i) => i.id)))} style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}>
            <Ionicons name={picked.size === shown.length && shown.length ? 'checkbox' : 'square-outline'} size={22} color={colors.accent} />
            <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 8 }}>{picked.size === shown.length && shown.length ? 'Desmarcar todos' : 'Selecionar todos'}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={removePicked} disabled={!picked.size} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: picked.size ? colors.danger : colors.card2 }}>
            <Ionicons name="trash" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 6 }}>Excluir{picked.size ? ` (${picked.size})` : ''}</Text>
          </Pressable>
        </View>
      ) : null}
      <ItemSheet
        item={sheetItem}
        catalogs={catalogs}
        onToggle={async (c) => setCatalogs(await toggleInCatalog(c.id, sheetItem.id))}
        onNew={() => { setSheetItem(null); setEditor({ open: true, catalog: null }); }}
        onRemove={() => remove(sheetItem)}
        onClose={() => setSheetItem(null)}
      />
      <CatalogModal visible={editor.open} catalog={editor.catalog} onSave={saveCatalog} onDelete={removeCatalog} onClose={() => setEditor({ open: false, catalog: null })} />
    </SafeAreaView>
  );
}
