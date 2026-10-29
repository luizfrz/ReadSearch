import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

// Barra de progresso da busca: avança sozinha até ~90% enquanto espera, salta para o
// valor real quando uma fonte responde e completa em 100% ao terminar.
export default function SearchProgress({ active, done = 0, total = 1, label }) {
  const value = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const id = value.addListener(({ value: v }) => setPct(Math.round(v * 100)));
    return () => value.removeListener(id);
  }, [value]);

  useEffect(() => {
    if (active) {
      setVisible(true);
      value.setValue(0);
      fade.setValue(1);
      Animated.timing(value, { toValue: 0.9, duration: 5000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      const loop = Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: false }));
      shimmer.setValue(0);
      loop.start();
      return () => loop.stop();
    }
    if (visible) {
      value.stopAnimation();
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: false }),
      ]).start(() => setVisible(false));
    }
  }, [active]);

  // Fonte respondeu: garante pelo menos a fração real concluída.
  useEffect(() => {
    if (!active || !done) return;
    value.stopAnimation((cur) => {
      const target = Math.max(cur, Math.min(0.9, (done / total) * 0.9 + 0.1));
      Animated.timing(value, { toValue: target, duration: 250, useNativeDriver: false }).start(() =>
        Animated.timing(value, { toValue: 0.9, duration: 4000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
      );
    });
  }, [done]);

  if (!visible) return null;
  const width = value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const shine = shimmer.interpolate({ inputRange: [0, 1], outputRange: ['-30%', '130%'] });

  return (
    <Animated.View style={{ opacity: fade, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{label || 'Buscando…'}</Text>
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{pct}%</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.card2, overflow: 'hidden' }}>
        <Animated.View style={{ width, height: '100%', overflow: 'hidden' }}>
          <LinearGradient colors={[colors.accent, colors.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', left: shine, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}
