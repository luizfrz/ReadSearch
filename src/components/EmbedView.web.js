import React from 'react';

export default function EmbedView({ uri }) {
  return <iframe title="leitor" src={uri} allowFullScreen style={{ flex: 1, width: '100%', height: '100%', border: 0 }} />;
}
