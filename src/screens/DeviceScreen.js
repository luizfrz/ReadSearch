import React, { useCallback, useContext, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { clearDownloads, fmtBytes, getMemoryInfo } from '../device';
import { clearCache } from '../cache';
import { colors } from '../theme';
import { WelcomeContext } from '../welcome';

function Row({ icon, label, value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border }}>
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={{ color: colors.muted, flex: 1, marginLeft: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

export default function DeviceScreen() {
  const [info, setInfo] = useState(null);
  const welcome = useContext(WelcomeContext);
  const load = useCallback(() => { getMemoryInfo().then(setInfo).catch(() => setInfo({})); }, []);
  useFocusEffect(load);

  const used = info && info.diskTotal != null && info.diskFree != null ? info.diskTotal - info.diskFree : null;
  const pct = used != null && info.diskTotal ? Math.min(1, used / info.diskTotal) : 0;

  const clean = async () => {
    await clearCache();
    await clearDownloads();
    load();
    if (Platform.OS !== 'web') Alert.alert('Pronto', 'Cache e downloads removidos.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>Memória</Text>
        <Text style={{ color: colors.muted, marginBottom: 16 }}>{info?.model || 'Seu aparelho'}</Text>

        <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.muted }}>Armazenamento livre</Text>
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800', marginVertical: 4 }}>{fmtBytes(info?.diskFree)}</Text>
          <Text style={{ color: colors.muted, marginBottom: 12 }}>de {fmtBytes(info?.diskTotal)} no total</Text>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.card2, overflow: 'hidden' }}>
            <LinearGradient colors={[colors.accent, colors.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${pct * 100}%`, height: '100%' }} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{fmtBytes(used)} em uso ({Math.round(pct * 100)}%)</Text>
        </View>

        <View style={{ backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 6, marginTop: 14, borderWidth: 1, borderColor: colors.border }}>
          <Row icon="hardware-chip-outline" label="Memória RAM" value={fmtBytes(info?.ram)} />
          <Row icon="book-outline" label="Usado pelo ReadSearch" value={fmtBytes(info?.appUsed)} />
        </View>

        <Pressable onPress={welcome.open} style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'center' }}>
          <Ionicons name="information-circle-outline" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 8 }}>Como o ReadSearch funciona</Text>
        </Pressable>

        <Pressable onPress={clean} style={{ marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.accent, flexDirection: 'row', justifyContent: 'center' }}>
          <Ionicons name="trash-outline" size={18} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: '700', marginLeft: 8 }}>Limpar cache e downloads</Text>
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
          Os dados do app ficam salvos no armazenamento local (localStorage na web).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
