import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Cover from './Cover';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// Cartão em grade (2 colunas): capa grande + título + autor.
export default function BookCard({ item, onPress, onLongPress, selecting, checked }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ flex: 1, margin: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <Cover uri={item.cover} title={item.title} kind={item.kind} style={{ aspectRatio: 2 / 3, width: '100%', elevation: 4, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }} />
      {selecting ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, aspectRatio: 2 / 3, borderRadius: 12, backgroundColor: checked ? 'rgba(61,139,255,0.28)' : 'rgba(0,0,0,0.25)', borderWidth: checked ? 3 : 0, borderColor: colors.accent }}>
          <Ionicons name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={checked ? colors.accent : '#fff'} style={{ position: 'absolute', top: 6, right: 6 }} />
        </View>
      ) : null}
      <View style={{ paddingTop: 8, paddingHorizontal: 2 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={2}>{item.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {item.author || item.source || (item.fileType || '').toUpperCase()}
        </Text>
        {item.formats && item.formats.length ? (
          <View style={{ flexDirection: 'row', marginTop: 5 }}>
            {item.formats.slice(0, 3).map((f) => (
              <Text key={f} style={{ color: colors.accent, borderColor: colors.border, borderWidth: 1, borderRadius: 6, fontSize: 9, fontWeight: '800', paddingHorizontal: 5, paddingVertical: 1, marginRight: 4 }}>{f.toUpperCase()}</Text>
            ))}
          </View>
        ) : null}
        {item.total > 1 ? (
          <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.card2, marginTop: 6, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${Math.min(100, ((item.page + 1) / item.total) * 100)}%`, backgroundColor: colors.accent }} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
