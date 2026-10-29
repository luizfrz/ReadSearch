import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import BookCard from '../components/BookCard';
import { getLibrary, removeFromLibrary } from '../storage';
import { colors } from '../theme';

export default function LibraryScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const load = useCallback(() => { getLibrary().then(setItems); }, []);
  useFocusEffect(load);

  const importFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled) return;
    const f = res.assets[0];
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf', 'cbz', 'cbr', 'epub'].includes(ext)) return Alert.alert('Formato não suportado', 'Use PDF, CBZ, CBR ou EPUB.');
    let uri = f.uri;
    if (Platform.OS !== 'web') {
      uri = FileSystem.documentDirectory + Date.now() + '_' + f.name.replace(/\s+/g, '_');
      await FileSystem.copyAsync({ from: f.uri, to: uri });
    }
    navigation.navigate('Reader', {
      entry: { id: `local:${f.name}:${f.size}`, title: f.name.replace(/\.\w+$/, ''), localUri: uri, fileType: ext, kind: ['cbz', 'cbr'].includes(ext) ? 'hq' : 'book', source: 'Arquivo local' },
    });
  };

  const confirmRemove = (item) => {
    const go = () => removeFromLibrary(item.id).then(load);
    if (Platform.OS === 'web') return window.confirm(`Remover "${item.title}"?`) && go();
    Alert.alert('Remover', `Tirar "${item.title}" da biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: go },
    ]);
  };

  const header = (
    <View>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>Biblioteca</Text>
      <Text style={{ color: colors.muted, marginBottom: 14 }}>{items.length} {items.length === 1 ? 'item' : 'itens'} · toque e segure para remover</Text>
      <Pressable onPress={importFile} style={{ marginBottom: 14 }}>
        <LinearGradient colors={[colors.accent, colors.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 8 }}>Importar PDF / CBZ / CBR / EPUB</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="library-outline" size={56} color={colors.border} />
            <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>Sua biblioteca está vazia.{'\n'}Busque algo ou importe um arquivo.</Text>
          </View>
        }
        renderItem={({ item }) => <BookCard item={item} onPress={() => navigation.navigate('Reader', { entry: item })} onLongPress={() => confirmRemove(item)} />}
      />
    </SafeAreaView>
  );
}
