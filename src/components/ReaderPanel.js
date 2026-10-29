import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// Painel de notas de texto e marcadores de página (ir para a página, apagar, criar nota).
export default function ReaderPanel({ visible, page, quote, notes, pageMarks, label = 'Página', onAdd, onDeleteNote, onGoTo, onToggleMark, onClose }) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable onPress={() => {}} style={{ maxHeight: 560, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 10 }}>Notas e marcadores</Text>

            {pageMarks.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
                {pageMarks.map((p) => (
                  <Pressable key={p} onPress={() => { onGoTo(p); onClose(); }} onLongPress={() => onToggleMark(p)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card2, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 }}>
                    <Ionicons name="bookmark" size={14} color="#ffd166" />
                    <Text style={{ color: colors.text, marginLeft: 6, fontWeight: '600' }}>{label} {p + 1}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <FlatList
              data={notes}
              keyExtractor={(n) => n.id}
              style={{ maxHeight: 240 }}
              ListEmptyComponent={<Text style={{ color: colors.muted, marginBottom: 10 }}>Nenhuma nota ainda.</Text>}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: colors.card2, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  {item.quote ? <Text style={{ color: colors.muted, fontStyle: 'italic', marginBottom: 4 }} numberOfLines={3}>“{item.quote}”</Text> : null}
                  <Text style={{ color: colors.text }}>{item.text}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Pressable onPress={() => { onGoTo(item.page); onClose(); }}>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>{label} {item.page + 1} →</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteNote(item.id)}><Ionicons name="trash-outline" size={16} color={colors.danger} /></Pressable>
                  </View>
                </View>
              )}
            />

            {quote ? <Text style={{ color: colors.muted, fontStyle: 'italic', marginVertical: 6 }} numberOfLines={2}>“{quote}”</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 }}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={`Nova nota (${label.toLowerCase()} ${page + 1})…`}
                placeholderTextColor={colors.muted}
                multiline
                style={{ flex: 1, backgroundColor: colors.card2, color: colors.text, borderRadius: 12, padding: 12, maxHeight: 100, borderWidth: 1, borderColor: colors.border }}
              />
              <Pressable onPress={submit} style={{ marginLeft: 8, width: 46, height: 46, borderRadius: 23, backgroundColor: text.trim() ? colors.accent : colors.card2, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
