import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { captureAndShare, captureToFile, shareToWhatsApp } from '../share';
import { colors } from '../theme';

const THEMES = [
  ['#0b1b4d', '#5b7bd5'],
  ['#2f6bff', '#4dd0ff'],
  ['#0f2027', '#2c5364'],
  ['#141e30', '#243b55'],
];

// Cartão no formato 9:16 (ideal para Status do WhatsApp e Stories) com o trecho citado.
export default function ShareImageModal({ visible, text, title, author, onClose }) {
  const card = useRef(null);
  const [theme, setTheme] = useState(0);
  const [busy, setBusy] = useState(false);
  const quote = (text || '').length > 600 ? `${text.slice(0, 600)}…` : text || '';
  const size = quote.length < 120 ? 26 : quote.length < 300 ? 21 : 16;

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const size1080 = { width: 1080, height: 1920 };
  const toStatus = () => run(async () => shareToWhatsApp(await captureToFile(card, size1080), 'trecho.png', 'image/png'));
  const toOthers = () => run(() => captureAndShare(card, size1080));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', paddingTop: 40, paddingBottom: 20 }}>
        <View ref={card} collapsable={false} style={{ width: 270, height: 480, borderRadius: 20, overflow: 'hidden' }}>
          <LinearGradient colors={THEMES[theme]} style={{ flex: 1, padding: 26, justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 64, fontWeight: '800', lineHeight: 64 }}>“</Text>
            <Text style={{ color: '#fff', fontSize: size, lineHeight: size * 1.45, fontFamily: undefined, fontWeight: '600' }}>{quote}</Text>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.35)', marginVertical: 18, width: 40 }} />
            <Text style={{ color: '#fff', fontWeight: '800' }} numberOfLines={2}>{title}</Text>
            {author ? <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 2 }} numberOfLines={1}>{author}</Text> : null}
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 20, letterSpacing: 1 }}>READSEARCH</Text>
          </LinearGradient>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          {THEMES.map((t, i) => (
            <Pressable key={i} onPress={() => setTheme(i)} style={{ marginHorizontal: 6 }}>
              <LinearGradient colors={t} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: theme === i ? 3 : 0, borderColor: '#fff' }} />
            </Pressable>
          ))}
        </View>

        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12, textAlign: 'center', paddingHorizontal: 30 }}>
          No WhatsApp, escolha "Meu status" no topo da lista de contatos.
        </Text>

        <View style={{ flexDirection: 'row', marginTop: 'auto', paddingHorizontal: 20, width: '100%' }}>
          <Pressable onPress={onClose} style={{ flex: 1, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontWeight: '700' }}>Fechar</Text>
          </Pressable>
          <Pressable onPress={toOthers} disabled={busy} style={{ padding: 14, alignItems: 'center' }}>
            <Ionicons name="share-social-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={toStatus} disabled={busy} style={{ flex: 2 }}>
            <LinearGradient colors={['#25d366', '#128c7e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 14, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="logo-whatsapp" size={20} color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 8 }}>Enviar para o Status</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
