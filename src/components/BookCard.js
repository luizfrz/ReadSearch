import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Cover from './Cover';
import { colors } from '../theme';

// Cartão em grade (2 colunas): capa grande + título + autor.
export default function BookCard({ item, onPress, onLongPress }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ flex: 1, margin: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <Cover uri={item.cover} title={item.title} kind={item.kind} style={{ aspectRatio: 2 / 3, width: '100%', elevation: 4, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }} />
      <View style={{ paddingTop: 8, paddingHorizontal: 2 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={2}>{item.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {item.author || item.source || (item.fileType || '').toUpperCase()}
        </Text>
        {item.total > 1 ? (
          <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.card2, marginTop: 6, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${Math.min(100, ((item.page + 1) / item.total) * 100)}%`, backgroundColor: colors.accent }} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
