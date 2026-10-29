import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

const POINTS = [
  { icon: 'globe-outline', title: 'Tudo vem da web', text: 'O ReadSearch não tem catálogo próprio. Ele apenas busca o que já está disponível publicamente na internet.' },
  { icon: 'server-outline', title: 'Nada hospedado no app', text: 'Nenhuma HQ, livro ou artigo está guardado no aplicativo. Os arquivos continuam nos sites de origem.' },
  { icon: 'library-outline', title: 'Fontes abertas', text: 'As buscas consultam Internet Archive, Project Gutenberg e OpenAlex, que reúnem obras de acesso livre.' },
  { icon: 'download-outline', title: 'Você controla o que fica no aparelho', text: 'Só o que você abre é baixado para ler e pode ser apagado quando quiser, na aba Memória.' },
];

// Tela de boas-vindas: explica como o app funciona.
export default function Welcome({ onClose, first }) {
  return (
    <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, zIndex: 9 }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 12 }}>
        <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 24 }}>
          <LinearGradient colors={[colors.accent, colors.accent2]} style={{ width: 84, height: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="search" size={42} color="#fff" />
          </LinearGradient>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 16 }}>
            Read<Text style={{ color: colors.accent }}>Search</Text>
          </Text>
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 8, fontSize: 15 }}>
            Um buscador de HQs, livros e artigos disponíveis na web.
          </Text>
        </View>

        {POINTS.map((p) => (
          <View key={p.title} style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={p.icon} size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{p.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 19 }}>{p.text}</Text>
            </View>
          </View>
        ))}

        <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Os direitos de cada obra pertencem aos seus autores e às fontes de origem.
        </Text>
      </ScrollView>
      <View style={{ padding: 24, paddingTop: 8 }}>
        <Pressable onPress={onClose}>
          <LinearGradient colors={[colors.accent, colors.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 16, borderRadius: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{first ? 'Entendi, começar' : 'Fechar'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
