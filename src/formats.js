// Formatos que o app lê direto e os que ele converte automaticamente.
export const NATIVE = ['pdf', 'epub', 'cbz'];
// Convertidos no próprio aparelho para EPUB (leitura em texto reflowável, com marcação de parágrafos).
export const LOCAL_CONVERT = ['txt', 'md', 'html', 'htm', 'xhtml', 'fb2', 'docx'];
// Exigem o servidor de conversão (server/proxy.js com Calibre, djvulibre ou 7z/unrar).
export const SERVER_CONVERT = { mobi: 'epub', azw: 'epub', azw3: 'epub', lit: 'epub', rtf: 'epub', doc: 'epub', djvu: 'pdf', cbr: 'cbz' };

export const READABLE = [...NATIVE, ...LOCAL_CONVERT, ...Object.keys(SERVER_CONVERT)];
export const extOf = (name) => (name.split('?')[0].split('.').pop() || '').toLowerCase();

// Nomes de formato do Internet Archive -> extensão que o app abre. Versões criptografadas
// (ACS/LCP, só para empréstimo) não estão aqui de propósito: não dá para ler.
const IA_FORMATS = {
  'epub': 'epub', 'text pdf': 'pdf', 'image container pdf': 'pdf', 'pdf': 'pdf', 'adobe pdf': 'pdf',
  'comic book zip': 'cbz', 'comic book rar': 'cbr', 'djvu': 'djvu', 'mobi': 'mobi', 'kindle': 'mobi',
  'fb2': 'fb2', 'djvutxt': 'txt',
};
export function readableFormats(iaFormats = []) {
  const out = new Set();
  for (const f of iaFormats) {
    const ext = IA_FORMATS[String(f).toLowerCase()];
    if (ext) out.add(ext);
  }
  return [...out];
}

// Tipos de origem que o leitor sabe abrir (cada um tem tratamento próprio em ReaderScreen).
const OPENABLE_SOURCES = ['ia', 'web', 'pdf', 'epub', 'cbz', 'manga', 'github', 'wikisource'];
export const isOpenable = (item) => !!(item && item.resolve && OPENABLE_SOURCES.includes(item.resolve.type));
