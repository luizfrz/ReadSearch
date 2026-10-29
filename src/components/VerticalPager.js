import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// Uma página de mangá na largura da tela; a altura vem da proporção real da imagem.
function Page({ uri, width, marked, selected, onTap }) {
  const [ratio, setRatio] = useState(1.45);
  const [state, setState] = useState('loading');
  return (
    <Pressable onPress={onTap}>
      <View style={{ width, height: width * ratio, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Image
          source={{ uri }}
          style={{ width, height: width * ratio }}
          resizeMode="contain"
          onLoad={(e) => {
            const s = e.nativeEvent && e.nativeEvent.source;
            if (s && s.width) setRatio(s.height / s.width);
            setState('ok');
          }}
          onError={() => setState('error')}
        />
        {state === 'loading' ? <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center' }} color={colors.accent} /> : null}
        {state === 'error' ? <Text style={{ position: 'absolute', alignSelf: 'center', color: colors.muted }}>Falha ao carregar a página</Text> : null}
        {marked ? <Ionicons name="bookmark" size={30} color="#ffd166" style={{ position: 'absolute', top: 0, right: 12 }} /> : null}
        {selected ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderWidth: 3, borderColor: colors.accent }} /> : null}
      </View>
    </Pressable>
  );
}

// Leitura vertical contínua (estilo webtoon): rola de uma página para a outra sem cortes.
export default function VerticalPager({ urls, marks, selected, onSelect, onPage, footer }) {
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState(0);
  const viewable = useRef(({ viewableItems }) => {
    if (viewableItems.length) setCurrent(viewableItems[0].index);
  }).current;

  useEffect(() => {
    onPage && onPage(current, urls.length);
    urls.slice(current + 1, current + 4).forEach((u) => Image.prefetch(u).catch(() => {}));
  }, [current]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={urls}
        keyExtractor={(u) => u}
        initialNumToRender={3}
        windowSize={7}
        onViewableItemsChanged={viewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        ListFooterComponent={footer}
        renderItem={({ item, index }) => (
          <Page uri={item} width={width} marked={marks.includes(index)} selected={selected === index} onTap={() => onSelect(selected === index ? null : index)} />
        )}
      />
      <View pointerEvents="none" style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{current + 1} / {urls.length}</Text>
      </View>
    </View>
  );
}
