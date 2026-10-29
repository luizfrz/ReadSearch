import { useEffect, useRef, useState } from 'react';
import { loadEpub, renderChapter } from './epub';
import { addMarker, getHighlights, getMarkers, removeMarker, setHighlight, shareQuote } from './highlights';

// Estado do leitor de EPUB: capítulo atual, parágrafo selecionado e marcações salvas.
export function useEpub({ uri, bookId, title, author, initialPage = 0, onPage, marker, controlRef }) {
  const [epub, setEpub] = useState(null);
  const [index, setIndex] = useState(initialPage);
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  const [selection, setSelection] = useState(null);
  const [range, setRange] = useState(null); // trecho de texto selecionado
  const [markSel, setMarkSel] = useState(null); // marca-texto tocado (id)
  const marks = useRef([]);
  const markerRef = useRef(marker);
  markerRef.current = marker;
  const autoApply = useRef(null);
  const markers = useRef([]);

  useEffect(() => {
    Promise.all([loadEpub(uri), getHighlights(bookId), getMarkers(bookId)])
      .then(([e, h, m]) => { marks.current = h; markers.current = m; setEpub(e); })
      .catch((e) => setError(e.message));
  }, [uri]);

  useEffect(() => {
    if (!epub) return;
    const i = Math.min(index, epub.chapters.length - 1);
    setSelection(null);
    setRange(null);
    setMarkSel(null);
    const idxs = marks.current.filter((h) => h.chapter === i).map((h) => h.idx);
    renderChapter(epub, i, idxs, markers.current.filter((m) => m.chapter === i)).then(setHtml).catch((e) => setError(e.message));
    onPage && onPage(i, epub.chapters.length);
  }, [epub, index]);

  // Mensagens vindas da página do capítulo (toque em parágrafo).
  const onMessage = (raw) => {
    try {
      const m = JSON.parse(raw);
      if (m.t === 'sel') controlRef && (controlRef.current.selection = m.text);
      if (m.t === 'sel') setSelection({ i: m.i, text: m.text, marked: m.marked });
      else if (m.t === 'clear') setSelection(null);
      else if (m.t === 'range') {
        const r = { i: m.i, start: m.start, end: m.end, text: m.text };
        if (controlRef) controlRef.current.selection = m.text;
        // Com o marca-texto ligado, o trecho selecionado já recebe a cor escolhida.
        if (markerRef.current && markerRef.current.on && autoApply.current) autoApply.current(r, markerRef.current.color);
        else { setRange(r); setMarkSel(null); }
      }
      else if (m.t === 'rangeClear') { setRange(null); if (controlRef) controlRef.current.selection = ''; }
      else if (m.t === 'mark') { setMarkSel(m.id); setRange(null); setSelection(null); }
    } catch {}
  };

  const toggleMark = async (run) => {
    if (!selection) return;
    const on = !selection.marked;
    marks.current = await setHighlight(bookId, { chapter: index, idx: selection.i, text: selection.text }, on);
    run(`window.__mark(${selection.i},${on})`);
    setSelection({ ...selection, marked: on });
  };

  // Aplica o marca-texto (cor) ao trecho selecionado.
  const applyMarker = async (color, run, r = range) => {
    if (!r) return;
    const id = Date.now().toString(36);
    markers.current = await addMarker(bookId, { id, chapter: index, idx: r.i, start: r.start, end: r.end, color, text: r.text });
    run(`window.__mk(${r.i},${r.start},${r.end},${JSON.stringify(color)},${JSON.stringify(id)})`);
    setRange(null);
  };

  const eraseMarker = async (run) => {
    if (!markSel) return;
    markers.current = await removeMarker(bookId, markSel);
    run(`window.__unmk(${JSON.stringify(markSel)})`);
    setMarkSel(null);
  };

  const setAutoApply = (run) => { autoApply.current = (r, c) => applyMarker(c, run, r); };

  const share = () => selection && shareQuote({ text: selection.text, title, author });

  if (controlRef) controlRef.current.goTo = (n) => setIndex(n);

  return { setAutoApply, range, markSel, applyMarker, eraseMarker, epub, index, setIndex, html, error, selection, onMessage, toggleMark, share, clearSelection: () => setSelection(null) };
}
