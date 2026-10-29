import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Text, useWindowDimensions, View } from 'react-native';
import JSZip from 'jszip';
import { readBase64 } from '../files';
import { colors } from '../theme';

const IMG = /\.(jpe?g|png|webp|gif)$/i;
const MIME = { png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

function Page({ zip, name, width, height }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    const ext = name.split('.').pop().toLowerCase();
    zip.file(name).async('base64').then((b64) => alive && setSrc(`data:${MIME[ext] || 'image/jpeg'};base64,${b64}`));
    return () => { alive = false; };
  }, [zip, name]);
  return (
    <View style={{ width, height, justifyContent: 'center' }}>
      {src ? <Image source={{ uri: src }} style={{ width, height }} resizeMode="contain" /> : <ActivityIndicator color={colors.accent} />}
    </View>
  );
}

// Leitor de HQ (.cbz): uma página por tela, deslize para virar.
export default function CbzView({ uri, initialPage = 0, onPage }) {
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState({ zip: null, names: [], error: null });
  const [current, setCurrent] = useState(initialPage);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b64 = await readBase64(uri);
        // CBR de verdade usa RAR (assinatura "Rar!"); muitos .cbr são ZIP renomeado.
        if (b64.startsWith('UmFyIQ')) throw new Error('Este arquivo usa compactação RAR real (CBR). Converta para CBZ para ler.');
        const zip = await JSZip.loadAsync(b64, { base64: true });
        const names = Object.keys(zip.files)
          .filter((n) => !zip.files[n].dir && IMG.test(n) && !n.includes('__MACOSX'))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (alive) setState({ zip, names, error: names.length ? null : 'Nenhuma imagem encontrada.' });
      } catch (e) {
        if (alive) setState({ zip: null, names: [], error: e.message });
      }
    })();
    return () => { alive = false; };
  }, [uri]);

  if (state.error) return <Text style={{ color: colors.muted, padding: 20 }}>{state.error}</Text>;
  if (!state.zip) return <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />;

  const h = height - 120;
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        ref={ref}
        data={state.names}
        horizontal
        pagingEnabled
        keyExtractor={(n) => n}
        initialScrollIndex={Math.min(initialPage, state.names.length - 1)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        windowSize={3}
        maxToRenderPerBatch={2}
        onMomentumScrollEnd={(e) => {
          const p = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrent(p);
          onPage && onPage(p, state.names.length);
        }}
        renderItem={({ item }) => <Page zip={state.zip} name={item} width={width} height={h} />}
      />
      <Text style={{ color: colors.muted, textAlign: 'center', padding: 8 }}>
        {current + 1} / {state.names.length}
      </Text>
    </View>
  );
}
