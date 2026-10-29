import React, { useEffect } from 'react';

// Na web o navegador cuida da renderização; o progresso não é rastreado.
export default function PdfView({ uri, initialPage = 0 }) {
  useEffect(() => {}, []);
  const src = initialPage > 0 ? `${uri}#page=${initialPage + 1}` : uri;
  return <iframe title="pdf" src={src} style={{ flex: 1, width: '100%', height: '100%', border: 0 }} />;
}
