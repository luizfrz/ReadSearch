import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// Tela de abertura animada "ReadSearch". Chama onDone ao terminar.
export default function Splash({ onDone }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(tag, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(out, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onDone && onDone());
  }, []);

  return (
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, opacity: out, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <Animated.View style={{ alignItems: 'center', opacity: fade, transform: [{ scale }] }}>
        <LinearGradient colors={['#ff5a5f', '#ff9a62']} style={{ width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="book" size={48} color="#fff" />
        </LinearGradient>
        <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 20, letterSpacing: 0.5 }}>
          Read<Text style={{ color: colors.accent }}>Search</Text>
        </Text>
      </Animated.View>
      <Animated.Text style={{ color: colors.muted, marginTop: 8, opacity: tag }}>HQs, livros e artigos em um só lugar</Animated.Text>
    </Animated.View>
  );
}
