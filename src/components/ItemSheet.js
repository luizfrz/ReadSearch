import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// Folha de ações de um item: escolher catálogos, criar catálogo novo ou remover da biblioteca.
export default function ItemSheet({ item, catalogs, onToggle, onNew, onRemove, onClose }) {
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }} numberOfLines={2}>{item && item.title}</Text>
          <Text style={{ color: colors.muted, marginTop: 2, marginBottom: 12 }}>Adicionar aos catálogos</Text>

          {catalogs.map((c) => {
            const on = item && c.itemIds.includes(item.id);
            return (
              <Pressable key={c.id} onPress={() => onToggle(c)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.color, marginRight: 12 }} />
                <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }}>{c.name}</Text>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? c.color : colors.muted} />
              </Pressable>
            );
          })}

          <Pressable onPress={onNew} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border }}>
            <Ionicons name="add-circle-outline" size={20} color={colors.accent} style={{ marginRight: 10 }} />
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Novo catálogo</Text>
          </Pressable>
          <Pressable onPress={onRemove} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border }}>
            <Ionicons name="trash-outline" size={20} color={colors.muted} style={{ marginRight: 10 }} />
            <Text style={{ color: colors.muted, fontWeight: '600' }}>Remover da biblioteca</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
