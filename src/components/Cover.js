import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { kindColors } from '../theme';

// Capa com fallback em gradiente + inicial do título quando não há imagem.
export default function Cover({ uri, title = '', kind = 'book', style }) {
  const [failed, setFailed] = useState(false);
  const showImg = uri && !failed;
  return (
    <View style={[{ borderRadius: 12, overflow: 'hidden' }, style]}>
      <LinearGradient colors={kindColors[kind] || kindColors.book} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 38, fontWeight: '800', opacity: 0.9 }}>{title.trim().charAt(0).toUpperCase()}</Text>
      </LinearGradient>
      {showImg ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          resizeMode="cover"
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />
      ) : null}
    </View>
  );
}
