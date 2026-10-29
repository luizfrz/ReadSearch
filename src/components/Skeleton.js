import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { colors } from '../theme';

export default function Skeleton({ style }) {
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [o]);
  return <Animated.View style={[{ backgroundColor: colors.card2, borderRadius: 12, opacity: o }, style]} />;
}
