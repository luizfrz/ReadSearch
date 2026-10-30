import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, PanResponder, Text, useWindowDimensions, View } from 'react-native';
import { captureToFile } from '../share';
import JSZip from 'jszip';
import { readBase64 } from '../files';
import { addMarker, getMarkers, removeMarker } from '../highlights';
import { colors } from '../theme';

const IMG = /\.(jpe?g|png|webp|gif)$/i;
const MIME = { png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

// Página + camada de marca-texto: com o destaque ligado, arraste para pintar uma área da página;
// toque (sem arrastar) numa área pintada para apagá-la.
function Page({ zip, name, index, width, height, rects, drawing, color, onAdd, onRemove, shotRef }) {
  const [src, setSrc] = useState(null);
  const [draft, setDraft] = useState(null);
  const start = useRef(null);
  const live = useRef({ drawing, color });
  live.current = { drawing, color };

  useEffect(() => {
    let alive = true;
    const ext = name.split('.').pop().toLowerCase();
    zip.file(name).async('base64').then((b64) => alive && setSrc(`data:${MIME[ext] || 'image/jpeg'};base64,${b64}`));
    return () => { alive = false; };
  }, [zip, name]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => live.current.drawing,
      onMoveShouldSetPanResponder: () => live.current.drawing,
      onPanResponderGrant: (e) => { start.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }; setDraft(null); },
      onPanResponderMove: (_e, g) => setDraft({ x: start.current.x, y: start.current.y, dx: g.dx, dy: g.dy }),
      onPanResponderRelease: (_e, g) => {
        const s = start.current;
        setDraft(null);
        if (!s) return;
        if (Math.abs(g.dx) < 12 && Math.abs(g.dy) < 12) return onRemove(index, s.x / width, s.y / height);
        const x = Math.min(s.x, s.x + g.dx), y = Math.min(s.y, s.y + g.dy);
        onAdd({ page: index, x: x / width, y: y / height, w: Math.abs(g.dx) / width, h: Math.abs(g.dy) / height, color: live.current.color });
      },
    })
  ).current;

  return (
    <View ref={shotRef} collapsable={false} style={{ width, height, justifyContent: 'center' }} {...pan.panHandlers}>
      {src ? <Image source={{ uri: src }} style={{ width, height }} resizeMode="contain" /> : <ActivityIndicator color={colors.accent} />}
      {rects.map((r) => (
        <View key={r.id} pointerEvents="none" style={{ position: 'absolute', left: r.x * width, top: r.y * height, width: r.w * width, height: r.h * height, backgroundColor: r.color, borderRadius: 3 }} />
      ))}
      {draft ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: Math.min(draft.x, draft.x + draft.dx), top: Math.min(draft.y, draft.y + draft.dy), width: Math.abs(draft.dx), height: Math.abs(draft.dy), backgroundColor: color, borderRadius: 3 }} />
      ) : null}
    </View>
  );
}

// Leitor de HQ (.cbz): uma página por tela, deslize para virar.
export default function CbzView({ uri, initialPage = 0, onPage, bookId, marker, controlRef }) {
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState({ zip: null, names: [], error: null });
  const [current, setCurrent] = useState(initialPage);
  const [marks, setMarks] = useState([]);
  const ref = useRef(null);
  const pageRefs = useRef({});
  const key = `cbz:${bookId}`;
  const drawing = !!(marker && marker.on);

  useEffect(() => { getMarkers(key).then(setMarks); }, [key]);

  useEffect(() => {
    if (controlRef) controlRef.current = { ...controlRef.current, goTo: (n) => { ref.current && ref.current.scrollToIndex({ index: n, animated: false }); setCurrent(n); onPage && onPage(n, state.names.length); },
      // Imagem só da página n (com os destaques), sem a interface do leitor.
      exportPage: (n) => captureToFile(pageRefs.current[n]),
    };
  });

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

  const add = async (r) => {
    setMarks(await addMarker(key, { ...r, id: Date.now().toString(36) }));
  };
  const remove = async (page, x, y) => {
    const hit = marks.find((m) => m.page === page && x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h);
    if (hit) setMarks(await removeMarker(key, hit.id));
  };

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
        scrollEnabled={!drawing}
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
        renderItem={({ item, index }) => (
          <Page
            zip={state.zip}
            name={item}
            index={index}
            width={width}
            height={h}
            rects={marks.filter((m) => m.page === index)}
            drawing={drawing}
            color={marker ? marker.color : '#ffd16699'}
            onAdd={add}
            onRemove={remove}
            shotRef={(r) => { pageRefs.current[index] = r; }}
          />
        )}
      />
      <Text style={{ color: colors.muted, textAlign: 'center', padding: 8 }}>
        {drawing ? 'Arraste para destacar · toque num destaque para apagar · ' : ''}{current + 1} / {state.names.length}
      </Text>
    </View>
  );
}
