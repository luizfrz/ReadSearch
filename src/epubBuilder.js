import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Gera um EPUB válido a partir de capítulos em HTML. Retorna o URI do arquivo.
export async function buildEpub({ id, title, author, chapters }) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
  );
  chapters.forEach((c, i) => {
    zip.file(
      `OEBPS/c${i}.xhtml`,
      `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${esc(c.title || title)}</title></head><body>${c.html}</body></html>`
    );
  });
  const manifest = chapters.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('');
  const spine = chapters.map((_, i) => `<itemref idref="c${i}"/>`).join('');
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author || '')}</dc:creator><dc:identifier id="id">${esc(id)}</dc:identifier><dc:language>pt</dc:language></metadata><manifest>${manifest}</manifest><spine>${spine}</spine></package>`
  );

  if (Platform.OS === 'web') {
    return URL.createObjectURL(await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' }));
  }
  const dest = FileSystem.documentDirectory + id.replace(/[^a-z0-9]+/gi, '_').slice(0, 80) + '.epub';
  const b64 = await zip.generateAsync({ type: 'base64' });
  await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
  return dest;
}
