import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATALOG_COLORS } from '../catalogs';
import { colors } from '../theme';

// Criar ou editar um catálogo (nome + cor). Com `catalog`, também permite excluir.
export default function CatalogModal({ visible, catalog, onSave, onDelete, onClose }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATALOG_COLORS[0]);

  useEffect(() => {
    if (visible) {
      setName(catalog ? catalog.name : '');
      setColor(catalog ? catalog.color : CATALOG_COLORS[0]);
    }
  }, [visible, catalog]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 14 }}>{catalog ? 'Editar catálogo' : 'Novo catálogo'}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nome (ex.: Para ler, Favoritos)"
            placeholderTextColor={colors.muted}
            autoFocus
            maxLength={30}
            style={{ backgroundColor: colors.card2, color: colors.text, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 16 }}>
            {CATALOG_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, marginRight: 10, marginBottom: 8, alignItems: 'center', justifyContent: 'center', borderWidth: color === c ? 3 : 0, borderColor: colors.text }}>
                {color === c ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {catalog ? (
              <Pressable onPress={() => onDelete(catalog)} style={{ padding: 12, marginRight: 8 }}>
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} style={{ flex: 1, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => name.trim() && onSave(name, color)}
              style={{ flex: 1, padding: 12, alignItems: 'center', borderRadius: 12, backgroundColor: name.trim() ? colors.accent : colors.card2 }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>Salvar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
