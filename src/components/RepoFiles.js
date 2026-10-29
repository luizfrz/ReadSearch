import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listRepoFiles } from '../api';
import { fmtBytes } from '../device';
import { colors } from '../theme';

// Livros (PDF/EPUB/CBZ) encontrados num repositório do GitHub.
export default function RepoFiles({ repo, onPick }) {
  const [files, setFiles] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listRepoFiles(repo)
      .then(setFiles)
      .catch((e) => setError(/403|429/.test(e.message) ? 'Limite de consultas do GitHub atingido. Tente de novo em alguns minutos.' : e.message));
  }, [repo]);

  if (error) return <Text style={{ color: colors.danger, padding: 20 }}>{error}</Text>;
  if (!files) return <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />;
  if (!files.length) return <Text style={{ color: colors.muted, padding: 20 }}>Nenhum arquivo PDF neste repositório.</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Text style={{ color: colors.muted, padding: 16, paddingBottom: 8 }}>{files.length} PDF(s) em {repo}</Text>
      <FlatList
        data={files}
        keyExtractor={(f) => f.path}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPick(item)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: 1, borderColor: colors.border }}>
            <Ionicons name="document-text-outline" size={24} color={colors.accent} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={2}>{item.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{item.type.toUpperCase()} · {fmtBytes(item.size)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        )}
      />
    </View>
  );
}
