import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ShareImageModal from './ShareImageModal';
import { colors } from '../theme';

// Barra que aparece ao tocar num parágrafo: marcar/desmarcar, compartilhar texto ou gerar imagem (Status).
export default function HighlightBar({ marked, text, title, author, onMark, onShare, onClose }) {
  const [image, setImage] = useState(false);
  const btn = (icon, label, on, tint) => (
    <Pressable onPress={on} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={{ color: tint, fontWeight: '700', fontSize: 11, marginTop: 2 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card2, borderTopWidth: 1, borderColor: colors.border }}>
      {btn(marked ? 'bookmark' : 'bookmark-outline', marked ? 'Desmarcar' : 'Marcar', onMark, '#ffd166')}
      {btn('chatbubble-ellipses-outline', 'Texto', onShare, colors.text)}
      {btn('logo-whatsapp', 'Imagem / Status', () => setImage(true), '#3ddc97')}
      <Pressable onPress={onClose} style={{ padding: 14 }}>
        <Ionicons name="close" size={20} color={colors.muted} />
      </Pressable>
      <ShareImageModal visible={image} text={text} title={title} author={author} onClose={() => setImage(false)} />
    </View>
  );
}
