import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { fmtBytes } from '../device';

// Tela de carregamento do leitor. `progress` de 0 a 1 mostra barra real (download);
// `null` mostra barra indeterminada (etapas sem tamanho conhecido).
export default function LoadingProgress({ title, status, progress, written, total, phase }) {
  const value = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: false }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    a.start();
    b.start();
    return () => { a.stop(); b.stop(); };
  }, []);

  useEffect(() => {
    if (progress != null) Animated.timing(value, { toValue: progress, duration: 200, useNativeDriver: false }).start();
  }, [progress]);

  const determinate = progress != null;
  const width = determinate ? value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '35%';
  const left = determinate ? 0 : sweep.interpolate({ inputRange: [0, 1], outputRange: ['-35%', '100%'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Animated.View style={{ transform: [{ scale }], marginBottom: 24 }}>
        <LinearGradient colors={[colors.accent, colors.accent2]} style={{ width: 84, height: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={determinate ? (phase === 'upload' ? 'cloud-upload' : 'cloud-download') : 'book'} size={42} color="#fff" />
        </LinearGradient>
      </Animated.View>

      {title ? <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center', marginBottom: 6 }} numberOfLines={2}>{title}</Text> : null}
      <Text style={{ color: colors.muted, marginBottom: 18, textAlign: 'center' }}>{status}</Text>

      <View style={{ width: '100%', maxWidth: 360 }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.card2, overflow: 'hidden' }}>
          <Animated.View style={{ width, left, height: '100%', borderRadius: 4, overflow: 'hidden' }}>
            <LinearGradient colors={[colors.accent, colors.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        </View>
        {determinate ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{fmtBytes(written)} / {fmtBytes(total)}</Text>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>{Math.round(progress * 100)}%</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
