import React from 'react';
import { WebView } from 'react-native-webview';

// Leitor online do Internet Archive para itens sem arquivo baixável.
export default function EmbedView({ uri }) {
  return <WebView source={{ uri }} allowsFullscreenVideo />;
}
