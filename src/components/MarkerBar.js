import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MARKER_COLORS } from '../highlights';
import { colors } from '../theme';

// Marca-texto: com um trecho selecionado, escolha a cor para destacá-lo; toque num destaque para removê-lo.
export default function MarkerBar({ range, onColor, onErase, onClose }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card2, borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Ionicons name="brush" size={20} color={colors.text} />
      {range ? (
        <>
          <Text style={{ color: colors.muted, marginHorizontal: 10, fontSize: 12 }}>Marcar</Text>
          {MARKER_COLORS.map((c) => (
            <Pressable key={c} onPress={() => onColor(c)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.slice(0, 7), marginRight: 10, borderWidth: 2, borderColor: colors.text }} />
          ))}
        </>
      ) : (
        <Pressable onPress={onErase} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, fontWeight: '700', marginLeft: 6 }}>Remover marcação</Text>
        </Pressable>
      )}
      <View style={{ flex: range ? 1 : 0 }} />
      <Pressable onPress={onClose} style={{ padding: 6 }}><Ionicons name="close" size={20} color={colors.muted} /></Pressable>
    </View>
  );
}
