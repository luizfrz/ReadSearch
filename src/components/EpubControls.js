import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function EpubControls({ index, total, onPrev, onNext }) {
  const btn = (name, on, disabled) => (
    <Pressable onPress={on} disabled={disabled} style={{ padding: 10, opacity: disabled ? 0.3 : 1 }}>
      <Ionicons name={name} size={26} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border }}>
      {btn('chevron-back', onPrev, index <= 0)}
      <Text style={{ color: colors.muted }}>Capítulo {index + 1} / {total}</Text>
      {btn('chevron-forward', onNext, index >= total - 1)}
    </View>
  );
}
