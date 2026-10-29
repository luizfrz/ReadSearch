import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Text, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme';

function Page({ uri, width, height }) {
  const [state, setState] = useState('loading');
  return (
    <View style={{ width, height, justifyContent: 'center' }}>
      <Image source={{ uri }} style={{ width, height }} resizeMode="contain" onLoad={() => setState('ok')} onError={() => setState('error')} />
      {state === 'loading' ? <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center' }} color={colors.accent} /> : null}
      {state === 'error' ? <Text style={{ position: 'absolute', alignSelf: 'center', color: colors.muted }}>Falha ao carregar a página</Text> : null}
    </View>
  );
}

// Páginas por URL remota, uma por tela. Pré-carrega as próximas para a virada ser rápida.
export default function ImagePager({ urls, onPage }) {
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    urls.slice(current + 1, current + 4).forEach((u) => Image.prefetch(u).catch(() => {}));
  }, [current, urls]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={urls}
        horizontal
        pagingEnabled
        keyExtractor={(u) => u}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        windowSize={3}
        onMomentumScrollEnd={(e) => {
          const p = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrent(p);
          onPage && onPage(p, urls.length);
        }}
        renderItem={({ item }) => <Page uri={item} width={width} height={height - 150} />}
      />
      <Text style={{ color: colors.muted, textAlign: 'center', padding: 8 }}>{current + 1} / {urls.length}</Text>
    </View>
  );
}
